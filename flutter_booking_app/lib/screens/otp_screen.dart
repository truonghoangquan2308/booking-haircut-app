import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:sms_autofill/sms_autofill.dart';

import '../app_session.dart';
import '../barber_post_login.dart';
import '../services/firebase_auth_service.dart';
import '../services/api_service.dart';

class OtpScreen extends StatefulWidget {
  final String phone;
  final String verificationId;
  final String role;
  final int? resendToken;

  const OtpScreen({
    super.key,
    required this.phone,
    required this.verificationId,
    required this.role,
    this.resendToken,
  });

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> with CodeAutoFill {
  final TextEditingController _otpController = TextEditingController();
  final FirebaseAuthService _authService = FirebaseAuthService();

  bool _isLoading = false;
  bool _isResending = false;

  late String _verificationId;
  int? _resendToken;

  Timer? _tickTimer;

  /// Thời gian mã OTP còn được coi là hiệu lực (hiển thị đếm ngược).
  static const int _otpValiditySeconds = 300;

  /// Sau mỗi lần gửi SMS, chờ ngắn mới cho phép gửi lại.
  static const int _resendCooldownSeconds = 90;

  int _validitySecondsLeft = _otpValiditySeconds;
  int _resendCooldownLeft = _resendCooldownSeconds;

  // ===== DEMO CONFIG (đổi tên cho hết warning) =====
  static const bool isDemo = false;
  static const String demoOtp = "123456";
  // ================================================

  @override
  void initState() {
    super.initState();
    _verificationId = widget.verificationId;
    _resendToken = widget.resendToken;
    _startTicker();
    // Android/iOS: lắng nghe SMS theo mẫu mã (SMS Retriever / tương tự).
    listenForCode();

    // Hiện OTP hint nếu là số test Firebase
    const testNumbers = {'+84901222222': '222222', '+84901234567': '123456'};
    final hint = testNumbers[widget.phone];
    if (hint != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _showSnack('Mã OTP của bạn: $hint');
      });
    }
  }

  @override
  void codeUpdated() {
    final raw = code;
    if (raw == null || raw.isEmpty) return;
    final digits = raw.replaceAll(RegExp(r'\D'), '');
    if (digits.isEmpty) return;
    final clipped = digits.length > 6 ? digits.substring(0, 6) : digits;
    if (_otpController.text == clipped) return;
    _otpController.value = TextEditingValue(
      text: clipped,
      selection: TextSelection.collapsed(offset: clipped.length),
    );
    setState(() {});
  }

  void _startTicker() {
    _tickTimer?.cancel();
    _tickTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        if (_validitySecondsLeft > 0) _validitySecondsLeft--;
        if (_resendCooldownLeft > 0) _resendCooldownLeft--;
      });
    });
  }

  String _formatDuration(int totalSeconds) {
    final m = totalSeconds ~/ 60;
    final s = totalSeconds % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  Future<void> _resendOtp() async {
    if (_resendCooldownLeft > 0 || _isResending || _isLoading) return;

    if (isDemo) {
      setState(() {
        _otpController.clear();
        _validitySecondsLeft = _otpValiditySeconds;
        _resendCooldownLeft = _resendCooldownSeconds;
      });
      _showSnack('Đã gửi lại mã demo');
      return;
    }

    setState(() => _isResending = true);

    try {
      await _authService.sendOtp(
        phone: widget.phone,
        forceResendingToken: _resendToken,
        onCodeSent: (verificationId, token) {
          if (!mounted) return;
          setState(() {
            _verificationId = verificationId;
            _resendToken = token;
            _otpController.clear();
            _validitySecondsLeft = _otpValiditySeconds;
            _resendCooldownLeft = _resendCooldownSeconds;
            _isResending = false;
          });
          _startTicker();
          const testNumbers = {
            '+84901222222': '222222',
            '+84901234567': '123456',
          };
          final hint = testNumbers[widget.phone];
          _showSnack(
            hint != null
                ? 'Đã gửi lại mã OTP. Mã thử nghiệm: $hint'
                : 'Đã gửi lại mã OTP',
          );
        },
        onError: (error) {
          if (mounted) {
            setState(() => _isResending = false);
            _showSnack(error);
          }
        },
      );
    } catch (e) {
      if (mounted) {
        setState(() => _isResending = false);
        _showSnack('Lỗi khi gửi lại OTP: $e');
      }
    }
  }

  @override
  void dispose() {
    _tickTimer?.cancel();
    cancel();
    unregisterListener();
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _confirmOtp() async {
    final otp = _otpController.text.trim();

    if (otp.length != 6) {
      _showSnack('Vui lòng nhập đủ 6 chữ số OTP');
      return;
    }

    setState(() => _isLoading = true);

    try {
      // ===== DEMO MODE =====
      if (isDemo) {
        await Future.delayed(const Duration(seconds: 1));

        if (otp == demoOtp) {
          if (!mounted) return;

          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute(builder: (_) => homeAfterLogin(widget.role)),
            (_) => false,
          );
        } else {
          _showSnack("Sai OTP demo");
        }
        return;
      }

      // ===== FIREBASE MODE =====
      final user = await _authService
          .verifyOtp(verificationId: _verificationId, otpCode: otp)
          .timeout(
            const Duration(seconds: 15),
            onTimeout: () => throw Exception('Timeout khi xác thực OTP'),
          );

      if (user == null) throw Exception('Xác minh thất bại');

      final data = await ApiService.verifyAndSaveUser(
        phone: widget.phone,
        firebaseUid: user.uid,
        role: widget.role,
      );
      final u = data['user'];
      if (u is Map<String, dynamic>) {
        AppSession.setFromUserMap(u);
      } else if (u is Map) {
        AppSession.setFromUserMap(Map<String, dynamic>.from(u));
      }

      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => homeAfterLogin(widget.role)),
        (_) => false,
      );
    } catch (e) {
      _showSnack('Lỗi xác thực OTP: $e');
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _showSnack(String msg) {
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    final expired = _validitySecondsLeft <= 0;
    final canResend = _resendCooldownLeft == 0 && !_isResending && !_isLoading;

    final keyboardInset = MediaQuery.viewInsetsOf(context).bottom;

    return Scaffold(
      backgroundColor: const Color(0xfff4f5f9),
      resizeToAvoidBottomInset: true,
      appBar: AppBar(
        backgroundColor: const Color(0xffffc107),
        title: const Text('Xác minh OTP'),
        foregroundColor: Colors.black,
        elevation: 0,
      ),
      body: Padding(
        padding: EdgeInsets.only(bottom: keyboardInset),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
                child: AutofillGroup(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SizedBox(height: 16),
                      const Icon(Icons.sms, size: 72, color: Color(0xffffc107)),
                      const SizedBox(height: 24),
                      Text(
                        'Nhập mã OTP đã gửi đến\n${widget.phone}',
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 16),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        expired
                            ? 'Mã OTP đã hết thời gian hiển thị. Vui lòng gửi lại mã hoặc thử xác minh nếu vẫn còn hiệu lực trên hệ thống.'
                            : 'Mã còn hiệu lực (ước tính): ${_formatDuration(_validitySecondsLeft)}',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 13,
                          color: expired ? Colors.red.shade700 : Colors.black54,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Center(
                        child: TextButton(
                          onPressed: canResend ? _resendOtp : null,
                          child: Text(
                            canResend
                                ? 'Gửi lại mã OTP'
                                : 'Gửi lại mã sau ${_formatDuration(_resendCooldownLeft)}',
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                      if (_isResending)
                        const Padding(
                          padding: EdgeInsets.only(bottom: 8),
                          child: Center(
                            child: SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Color(0xffffc107),
                              ),
                            ),
                          ),
                        ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _otpController,
                        keyboardType: TextInputType.number,
                        textInputAction: TextInputAction.done,
                        maxLength: 6,
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 28, letterSpacing: 8),
                        autofillHints: const [AutofillHints.oneTimeCode],
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                        ],
                        decoration: InputDecoration(
                          counterText: '',
                          filled: true,
                          fillColor: Colors.white,
                          hintText: '------',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide.none,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            SafeArea(
              top: false,
              minimum: const EdgeInsets.fromLTRB(24, 0, 24, 12),
              child: _isLoading
                  ? const Padding(
                      padding: EdgeInsets.symmetric(vertical: 12),
                      child: Center(
                        child: CircularProgressIndicator(
                          color: Color(0xffffc107),
                        ),
                      ),
                    )
                  : ElevatedButton(
                      onPressed: _confirmOtp,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xffffc107),
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text(
                        'Xác minh',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
