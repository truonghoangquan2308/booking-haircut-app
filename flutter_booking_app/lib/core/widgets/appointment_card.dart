import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../theme/app_theme.dart';

class AppointmentCard extends StatelessWidget {
  final String customerName;
  final String time;
  final String serviceCode;
  final double amount;
  final bool isRated;
  final bool showReviewButton;
  final VoidCallback? onTap;

  const AppointmentCard({
    super.key,
    required this.customerName,
    required this.time,
    required this.serviceCode,
    required this.amount,
    this.isRated = false,
    this.showReviewButton = true,
    this.onTap,
  });

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return '';
    final initials = parts.map((p) => p.isNotEmpty ? p[0] : '').take(2).join();
    return initials.toUpperCase();
  }

  String _fmt(double v) {
    final formatter = NumberFormat('#,###', 'vi_VN');
    return '${formatter.format(v.round())}đ';
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: AppTheme.cardRadius,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: AppTheme.surfaceColor,
          borderRadius: AppTheme.cardRadius,
          border: Border.all(color: AppTheme.borderColor, width: 0.5),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: AppTheme.primaryColor.withAlpha((0.15 * 255).round()),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(
                  _initials(customerName),
                  style: const TextStyle(
                    color: AppTheme.primaryDark,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    customerName,
                    style: const TextStyle(
                      fontWeight: FontWeight.w500,
                      fontSize: 14,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    serviceCode,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  _fmt(amount),
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                    color: AppTheme.successColor,
                  ),
                ),
                const SizedBox(height: 4),
                if (showReviewButton)
                  isRated
                      ? const Icon(Icons.star, size: 14, color: Colors.amber)
                      : TextButton(
                          onPressed: () {},
                          style: TextButton.styleFrom(
                            padding: EdgeInsets.zero,
                            minimumSize: const Size(0, 0),
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: const Text(
                            'Đánh giá',
                            style: TextStyle(
                              fontSize: 11,
                              color: AppTheme.primaryColor,
                            ),
                          ),
                        ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
