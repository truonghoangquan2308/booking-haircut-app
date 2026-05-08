import 'package:flutter/foundation.dart';

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
  BarberNotificationsService._() {
    _seedInitialNotifications();
  }

  static final BarberNotificationsService instance =
      BarberNotificationsService._();

  final ValueNotifier<List<BarberNotificationItem>> notifications =
      ValueNotifier<List<BarberNotificationItem>>(const []);

  int _nextId = 1;

  int get unreadCount =>
      notifications.value.where((item) => !item.isRead).length;

  void _seedInitialNotifications() {
    if (notifications.value.isNotEmpty) return;
    final now = DateTime.now();
    notifications.value = [
      BarberNotificationItem(
        id: _nextId++,
        type: 'booking',
        title: 'Có khách đặt lịch mới',
        message: 'Khách Nguyễn Minh Anh vừa đặt lịch cắt tóc lúc 09:00.',
        isRead: false,
        createdAt: now.subtract(const Duration(hours: 1)),
      ),
      BarberNotificationItem(
        id: _nextId++,
        type: 'review',
        title: 'Bạn nhận được đánh giá mới',
        message: 'Khách Đoàn Minh Huy vừa đánh giá 5 sao cho dịch vụ.',
        isRead: false,
        createdAt: now.subtract(const Duration(minutes: 40)),
      ),
      BarberNotificationItem(
        id: _nextId++,
        type: 'income',
        title: 'Cập nhật thu nhập ăn chia',
        message: 'Bạn nhận 340.000đ sau khi chia doanh thu với salon.',
        isRead: false,
        createdAt: now.subtract(const Duration(minutes: 15)),
      ),
    ];
  }

  void addBookingNotification({
    required String customerName,
    required String timeText,
  }) {
    _push(
      type: 'booking',
      title: 'Có khách đặt lịch mới',
      message: 'Khách $customerName vừa đặt lịch lúc $timeText.',
    );
  }

  void addReviewNotification({
    required String customerName,
    required int rating,
  }) {
    _push(
      type: 'review',
      title: 'Bạn nhận được đánh giá mới',
      message: 'Khách $customerName vừa đánh giá $rating sao cho dịch vụ.',
    );
  }

  void addIncomeNotification({required int amount}) {
    _push(
      type: 'income',
      title: 'Cập nhật thu nhập ăn chia',
      message:
          'Bạn nhận ${_formatMoney(amount)} sau khi chia doanh thu với salon.',
    );
  }

  void _push({
    required String type,
    required String title,
    required String message,
  }) {
    final list = List<BarberNotificationItem>.from(notifications.value);
    list.insert(
      0,
      BarberNotificationItem(
        id: _nextId++,
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
  }

  static String _formatMoney(int amount) {
    return '${amount.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => '.')}đ';
  }
}
