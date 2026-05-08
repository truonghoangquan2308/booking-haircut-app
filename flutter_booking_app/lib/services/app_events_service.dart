import 'package:flutter/foundation.dart';

class CartEntry {
  final String name;
  final int price;
  final int quantity;

  const CartEntry({
    required this.name,
    required this.price,
    required this.quantity,
  });

  CartEntry copyWith({String? name, int? price, int? quantity}) {
    return CartEntry(
      name: name ?? this.name,
      price: price ?? this.price,
      quantity: quantity ?? this.quantity,
    );
  }
}

class LocalNotificationItem {
  final int id;
  final String title;
  final String message;
  final bool isRead;
  final DateTime createdAt;

  const LocalNotificationItem({
    required this.id,
    required this.title,
    required this.message,
    required this.isRead,
    required this.createdAt,
  });

  LocalNotificationItem copyWith({
    int? id,
    String? title,
    String? message,
    bool? isRead,
    DateTime? createdAt,
  }) {
    return LocalNotificationItem(
      id: id ?? this.id,
      title: title ?? this.title,
      message: message ?? this.message,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}

class AppEventsService {
  AppEventsService._() {
    _seedInitialNotifications();
  }

  static final AppEventsService instance = AppEventsService._();

  final ValueNotifier<List<CartEntry>> cartItems =
      ValueNotifier<List<CartEntry>>(const []);

  final ValueNotifier<List<LocalNotificationItem>> localNotifications =
      ValueNotifier<List<LocalNotificationItem>>(const []);

  int _nextNotificationId = 1;

  int get cartCount =>
      cartItems.value.fold<int>(0, (sum, item) => sum + item.quantity);

  int get unreadNotificationCount =>
      localNotifications.value.where((item) => !item.isRead).length;

  void _seedInitialNotifications() {
    if (localNotifications.value.isNotEmpty) return;
    final now = DateTime.now();
    localNotifications.value = [
      LocalNotificationItem(
        id: _nextNotificationId++,
        title: 'Nhắc lịch cắt tóc',
        message: 'Bạn có lịch cắt tóc vào ngày mai lúc 09:00.',
        isRead: false,
        createdAt: now.subtract(const Duration(hours: 2)),
      ),
      LocalNotificationItem(
        id: _nextNotificationId++,
        title: 'Cập nhật giao diện',
        message: 'Ứng dụng vừa cập nhật giao diện mới cho trang tài khoản.',
        isRead: false,
        createdAt: now.subtract(const Duration(minutes: 30)),
      ),
    ];
  }

  void addToCart({required String name, required int price}) {
    final list = List<CartEntry>.from(cartItems.value);
    final index = list.indexWhere((e) => e.name == name);
    if (index >= 0) {
      final old = list[index];
      list[index] = old.copyWith(quantity: old.quantity + 1);
    } else {
      list.add(CartEntry(name: name, price: price, quantity: 1));
    }
    cartItems.value = list;
  }

  void increaseQuantity(int index) {
    final list = List<CartEntry>.from(cartItems.value);
    final old = list[index];
    list[index] = old.copyWith(quantity: old.quantity + 1);
    cartItems.value = list;
  }

  void decreaseQuantity(int index) {
    final list = List<CartEntry>.from(cartItems.value);
    final old = list[index];
    if (old.quantity > 1) {
      list[index] = old.copyWith(quantity: old.quantity - 1);
    } else {
      list.removeAt(index);
    }
    cartItems.value = list;
  }

  void clearCart() {
    cartItems.value = [];
  }

  void pushLocalNotification({required String title, required String message}) {
    final list = List<LocalNotificationItem>.from(localNotifications.value);
    list.insert(
      0,
      LocalNotificationItem(
        id: _nextNotificationId++,
        title: title,
        message: message,
        isRead: false,
        createdAt: DateTime.now(),
      ),
    );
    localNotifications.value = list;
  }

  void markLocalNotificationRead(int id) {
    final list = List<LocalNotificationItem>.from(localNotifications.value);
    final index = list.indexWhere((e) => e.id == id);
    if (index < 0) return;
    list[index] = list[index].copyWith(isRead: true);
    localNotifications.value = list;
  }

  static int parseMoney(String raw) {
    raw = raw.trim();
    // If contains decimal point, take the part before it
    if (raw.contains('.')) {
      raw = raw.split('.')[0];
    }
    // Remove any non-digit characters
    final digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
    return int.tryParse(digits) ?? 0;
  }
}
