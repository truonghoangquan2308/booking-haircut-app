import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';

class FirebaseAuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;

  String _friendlyPhoneAuthError(FirebaseAuthException e) {
    final message = (e.message ?? '').toLowerCase();
    final code = e.code.toLowerCase();

    // Seen on some Android devices when Firebase phone auth app verification
    // fails due to SHA / Play Integrity / project setup issues.
    if (code == 'internal-error' || message.contains('error code:39')) {
      return 'Không thể gửi OTP do cấu hình Firebase/Android chưa đúng (Error 39). '
          'Kiểm tra SHA-1/SHA-256, bật Phone Authentication, dùng máy có Google Play Services và thử lại.';
    }

    if (code == 'too-many-requests') {
      return 'Bạn thao tác quá nhiều lần. Vui lòng chờ vài phút rồi thử lại.';
    }

    if (code == 'invalid-phone-number') {
      return 'Số điện thoại không hợp lệ.';
    }

    return e.message ?? 'Xác minh thất bại';
  }

  String _normalizePhoneToE164(String input) {
    var raw = input.trim();
    raw = raw.replaceAll(RegExp(r'[\s\-\(\)\.]'), '');

    if (raw.startsWith('00')) {
      raw = '+${raw.substring(2)}';
    }

    // If already in E.164-ish, just ensure it begins with +
    if (raw.startsWith('+')) {
      if (raw.length < 8) {
        throw const FormatException('Số điện thoại quá ngắn.');
      }
      return raw;
    }

    // VN common input: 0xxxxxxxxx (10 digits)
    if (raw.startsWith('0')) {
      final national = raw.substring(1);
      if (national.length < 8) {
        throw const FormatException('Số điện thoại quá ngắn.');
      }
      return '+84$national';
    }

    // If user types country code without +
    if (raw.startsWith('84')) {
      final rest = raw.substring(2);
      if (rest.isEmpty) {
        throw const FormatException('Số điện thoại không hợp lệ.');
      }
      return '+84$rest';
    }

    // Fallback: treat as already containing country code digits
    if (raw.length < 8) {
      throw const FormatException('Số điện thoại quá ngắn.');
    }
    return '+$raw';
  }

  Future<void> sendOtp({
    required String phone,
    required void Function(String verificationId, int? resendToken) onCodeSent,
    required void Function(String error) onError,
    void Function(User user)? onAutoVerified,
    int? forceResendingToken,
  }) async {
    var codeSentCalled = false;
    var finished = false;
    Timer? watchdog;

    void finish() {
      if (finished) return;
      finished = true;
      watchdog?.cancel();
    }

    watchdog = Timer(const Duration(seconds: 75), () {
      if (finished || codeSentCalled) return;
      finished = true;
      onError(
        'Hết thời gian chờ Firebase. Kiểm tra mạng, SHA-1 trong Console, hoặc thử lại.',
      );
    });

    final String phoneE164;
    try {
      phoneE164 = _normalizePhoneToE164(phone);
    } catch (_) {
      finish();
      onError('Số điện thoại không hợp lệ. Ví dụ đúng: 0827640470 hoặc +84827640470');
      return;
    }

    await _auth.verifyPhoneNumber(
      phoneNumber: phoneE164,
      forceResendingToken: forceResendingToken,
      timeout: const Duration(seconds: 60),
      verificationCompleted: (PhoneAuthCredential credential) async {
        try {
          final userCredential = await _auth.signInWithCredential(credential);
          if (userCredential.user != null) {
            finish();
            onAutoVerified?.call(userCredential.user!);
          } else {
            finish();
            onError('Đăng nhập không trả về user.');
          }
        } catch (e) {
          finish();
          onError('Tự động xác thực thất bại: $e');
        }
      },
      verificationFailed: (FirebaseAuthException e) {
        finish();
        onError(_friendlyPhoneAuthError(e));
      },
      codeSent: (String verificationId, int? resendToken) {
        codeSentCalled = true;
        finish();
        onCodeSent(verificationId, resendToken);
      },
      codeAutoRetrievalTimeout: (_) {
        if (!codeSentCalled) {
          finish();
          onError('Không nhận được SMS (timeout). Vui lòng thử lại.');
        }
      },
    );
  }

  Future<User?> verifyOtp({
    required String verificationId,
    required String otpCode,
  }) async {
    final credential = PhoneAuthProvider.credential(
      verificationId: verificationId,
      smsCode: otpCode,
    );
    final result = await _auth.signInWithCredential(credential);
    return result.user;
  }
}
