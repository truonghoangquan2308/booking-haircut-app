import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../theme/app_theme.dart';

class EmptyStateWidget extends StatelessWidget {
  final String? svgAsset;
  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  const EmptyStateWidget({
    super.key,
    this.svgAsset,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        if (svgAsset != null)
          SvgPicture.asset(
            svgAsset!,
            width: 80,
            height: 80,
            color: AppTheme.textHint,
          )
        else
          Icon(Icons.inbox_rounded, size: 80, color: AppTheme.textHint),
        const SizedBox(height: 16),
        Text(
          title,
          style: textTheme.titleLarge?.copyWith(color: AppTheme.textPrimary),
          textAlign: TextAlign.center,
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 8),
          Text(
            subtitle!,
            style: textTheme.labelSmall?.copyWith(
              color: AppTheme.textSecondary,
            ),
            textAlign: TextAlign.center,
          ),
        ],
        if (actionLabel != null) ...[
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: onAction,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryColor,
              shape: RoundedRectangleBorder(
                borderRadius: AppTheme.buttonRadius,
              ),
            ),
            child: Text(actionLabel!),
          ),
        ],
      ],
    );
  }
}
