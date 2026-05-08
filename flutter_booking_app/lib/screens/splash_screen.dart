import 'dart:async';

import 'package:flutter/material.dart';

import 'login_screen.dart';

/// Splash chỉ hiển thị thương hiệu. Firebase đã khởi tạo trong [main].
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(const Duration(seconds: 2), _goToLogin);
  }

  void _goToLogin() {
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(builder: (_) => const LoginScreen()),
    );
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final width = media.size.width;
    final height = media.size.height;

    final baseWidth = 360.0;
    final scale = (width / baseWidth).clamp(0.8, 1.2);

    final logoSize = 120.0 * scale;
    final iconSize = 32.0 * scale;
    final spacing = 16.0 * scale;
    final textScale = 1.0 * scale;

    return Scaffold(
      backgroundColor: const Color(0xffffc107),
      body: SafeArea(
        child: SizedBox(
          width: double.infinity,
          height: double.infinity,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              SizedBox(height: height * 0.12),
              _buildLogoCircle(logoSize, iconSize),
              SizedBox(height: spacing * 1.5),
              Text(
                'GROUP 5',
                style: TextStyle(
                  fontSize: 26 * textScale,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
              SizedBox(height: 8 * scale),
              Text(
                'Haircut Booking App',
                style: TextStyle(
                  fontSize: 16 * textScale,
                  color: Colors.black87,
                ),
              ),
              const Spacer(),
              Padding(
                padding: EdgeInsets.symmetric(horizontal: 32 * scale),
                child: Column(
                  children: [
                    const Text(
                      'Đang khởi động...',
                      style: TextStyle(color: Colors.black87),
                    ),
                    SizedBox(height: 12 * scale),
                    LinearProgressIndicator(
                      valueColor: const AlwaysStoppedAnimation<Color>(
                        Colors.white,
                      ),
                      backgroundColor: Colors.white.withValues(alpha: 0.4),
                    ),
                    SizedBox(height: 24 * scale),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLogoCircle(double size, double iconSize) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(size * 0.4),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Icon(
            Icons.content_cut,
            size: iconSize * 1.3,
            color: const Color(0xff003366),
          ),
          Positioned(
            top: size * 0.18,
            left: size * 0.16,
            child: Icon(
              Icons.brush,
              size: iconSize,
              color: const Color(0xffffc107),
            ),
          ),
          Positioned(
            bottom: size * 0.18,
            right: size * 0.16,
            child: Icon(
              Icons.format_paint,
              size: iconSize,
              color: const Color(0xffffc107),
            ),
          ),
        ],
      ),
    );
  }
}
