import 'dart:async';

import 'package:flutter/foundation.dart';
import 'api_service.dart';

class BarberNotificationItem {
  final int id;
  final String type; // booking | review | income
  final String title;
  final String message;
  final bool isRead;
  final DateTime createdAt;

  const BarberNotificationItem({
    required this.id,
    required this.type,
    required this.title,
    required this.message,
    required this.isRead,
    required this.createdAt,
  });

  BarberNotificationItem copyWith({
    int? id,
    String? type,
    String? title,
    String? message,
    bool? isRead,
    DateTime? createdAt,
  }) {
    return BarberNotificationItem(
      id: id ?? this.id,
      type: type ?? this.type,
      title: title ?? this.title,
      message: message ?? this.message,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}

class BarberNotificationsService {
  BarberNotificationsService._();

  static final BarberNotificationsService instance =
      BarberNotificationsService._();

  final ValueNotifier<List<BarberNotificationItem>> notifications =
      ValueNotifier<List<BarberNotificationItem>>(const []);

  int? _currentUserId;
  Timer? _pollingTimer;

  int get unreadCount =>
      notifications.value.where((item) => !item.isRead).length;

  Future<void> load(int userId) async {
    _currentUserId = userId;
    await _fetchFromApi(userId);
    _pollingTimer?.cancel();
    _pollingTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (_currentUserId != null) _fetchFromApi(_currentUserId!);
    });
  }

  void dispose() {
    _pollingTimer?.cancel();
    _currentUserId = null;
    notifications.value = const [];
  }

  Future<void> _fetchFromApi(int userId) async {
    try {
      final raw = await ApiService.getNotifications(userId);
      final apiItems = raw.whereType<Map>().map((m) {
        final map = Map<String, dynamic>.from(m);
        final idRaw = map['id'];
        final id = idRaw is num
            ? idRaw.toInt()
            : int.tryParse(idRaw?.toString() ?? '') ?? 0;
        final type = (map['type'] ?? '').toString();
        final title = (map['title'] ?? map['type'] ?? 'Thông báo').toString();
        final message = (map['message'] ?? map['body'] ?? '').toString();
        final isRead = map['is_read'] == true || map['is_read'] == 1;
        final createdAt =
            DateTime.tryParse(map['created_at']?.toString() ?? '') ??
            DateTime.now();
        return BarberNotificationItem(
          id: id,
          type: type,
          title: title,
          message: message,
          isRead: isRead,
          createdAt: createdAt,
        );
      }).toList()..sort((a, b) => b.createdAt.compareTo(a.createdAt));

      final apiIds = apiItems.map((e) => e.id).toSet();
      final localOnly = notifications.value
          .where((e) => e.id < 0 && !apiIds.contains(e.id))
          .toList();

      notifications.value = [...localOnly, ...apiItems];
    } catch (e) {
      // keep existing list unchanged on error
    }
  }

  void addBookingNotification({
    required String customerName,
    required String timeText,
  }) {
    _pushLocal(
      type: 'booking',
      title: 'Có khách đặt lịch mới',
      message: 'Khách $customerName vừa đặt lịch lúc $timeText.',
    );
  }

  void addReviewNotification({
    required String customerName,
    required int rating,
  }) {
    _pushLocal(
      type: 'review',
      title: 'Bạn nhận được đánh giá mới',
      message: 'Khách $customerName vừa đánh giá $rating sao cho dịch vụ.',
    );
  }

  void addIncomeNotification({required int amount}) {
    _pushLocal(
      type: 'income',
      title: 'Cập nhật thu nhập ăn chia',
      message:
          'Bạn nhận ${_formatMoney(amount)} sau khi chia doanh thu với salon.',
    );
  }

  void _pushLocal({
    required String type,
    required String title,
    required String message,
  }) {
    final list = List<BarberNotificationItem>.from(notifications.value);
    list.insert(
      0,
      BarberNotificationItem(
        id: -(list.length + 1),
        type: type,
        title: title,
        message: message,
        isRead: false,
        createdAt: DateTime.now(),
      ),
    );
    notifications.value = list;
  }

  void markAsRead(int id) {
    final list = List<BarberNotificationItem>.from(notifications.value);
    final index = list.indexWhere((e) => e.id == id);
    if (index < 0) return;
    list[index] = list[index].copyWith(isRead: true);
    notifications.value = list;

    if (id < 0) return; // local-only, no API call

    try {
      ApiService.markNotificationRead(id);
    } catch (_) {
      // ignore errors, keep optimistic update
    }
  }

  static String _formatMoney(int amount) {
    return '${amount.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => '.')}đ';
  }
}
