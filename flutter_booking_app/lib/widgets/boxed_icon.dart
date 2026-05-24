import 'package:flutter/material.dart';

class BoxedIcon extends StatelessWidget {
  final IconData icon;
  final Color? iconColor;
  final double size;
  final double boxSize;

  const BoxedIcon(
    this.icon, {
    Key? key,
    this.iconColor,
    this.size = 22,
    this.boxSize = 42,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      width: boxSize,
      height: boxSize,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Center(
        child: Icon(icon, color: iconColor ?? Colors.orange, size: size),
      ),
    );
  }
}
