import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../theme/app_theme.dart';

class SkeletonBox extends StatelessWidget {
  final double width;
  final double height;
  final BorderRadius? radius;

  const SkeletonBox({
    super.key,
    required this.width,
    required this.height,
    this.radius,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: AppTheme.borderColor,
        borderRadius: radius ?? BorderRadius.circular(8),
      ),
    );
  }
}

class SkeletonAppointmentCard extends StatelessWidget {
  const SkeletonAppointmentCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: AppTheme.borderColor,
      highlightColor: const Color(0xFFF3F4F6),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: AppTheme.cardRadius,
          border: Border.all(color: AppTheme.borderColor, width: 0.5),
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: const BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(width: 120, height: 12, color: Colors.white),
                  const SizedBox(height: 8),
                  Container(width: 80, height: 10, color: Colors.white),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Container(width: 48, height: 16, color: Colors.white),
          ],
        ),
      ),
    );
  }
}

class SkeletonScheduleList extends StatelessWidget {
  final int itemCount;
  const SkeletonScheduleList({super.key, this.itemCount = 3});

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      itemBuilder: (_, _) => const SkeletonAppointmentCard(),
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemCount: itemCount,
    );
  }
}
