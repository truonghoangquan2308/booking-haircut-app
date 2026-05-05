import 'package:flutter/material.dart';
import 'package:flutter_booking_app/services/barber_notifications_service.dart';

class BarberNotificationsScreen extends StatefulWidget {
  const BarberNotificationsScreen({super.key});

  @override
  State<BarberNotificationsScreen> createState() =>
      _BarberNotificationsScreenState();
}

class _BarberNotificationsScreenState extends State<BarberNotificationsScreen> {
  final _service = BarberNotificationsService.instance;

  IconData _iconByType(String type, bool isRead) {
    switch (type) {
      case 'booking':
        return isRead ? Icons.event_note_outlined : Icons.event_available;
      case 'review':
        return isRead ? Icons.star_outline : Icons.star;
      case 'income':
        return isRead ? Icons.payments_outlined : Icons.account_balance_wallet;
      default:
        return isRead ? Icons.notifications_none : Icons.notifications_active;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Thông báo thợ'),
        backgroundColor: const Color(0xffffc107),
      ),
      backgroundColor: const Color(0xfff4f5f9),
      body: ValueListenableBuilder<List<BarberNotificationItem>>(
        valueListenable: _service.notifications,
        builder: (context, items, _) {
          if (items.isEmpty) {
            return const Center(
              child: Text(
                'Bạn chưa có thông báo nào',
                style: TextStyle(color: Colors.grey),
              ),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            separatorBuilder: (_, _) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final item = items[index];
              return ListTile(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                tileColor: Colors.white,
                leading: CircleAvatar(
                  backgroundColor: item.isRead
                      ? Colors.grey.shade200
                      : const Color(0xffffc107).withValues(alpha: 0.25),
                  child: Icon(
                    _iconByType(item.type, item.isRead),
                    color: item.isRead
                        ? Colors.grey.shade600
                        : const Color(0xffffa000),
                  ),
                ),
                title: Text(
                  item.title,
                  style: TextStyle(
                    fontWeight: item.isRead ? FontWeight.w500 : FontWeight.w700,
                  ),
                ),
                subtitle: Text(
                  item.message,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                trailing: item.isRead
                    ? const Icon(Icons.done, color: Colors.green, size: 20)
                    : TextButton(
                        onPressed: () => _service.markAsRead(item.id),
                        child: const Text('Đã đọc'),
                      ),
              );
            },
          );
        },
      ),
    );
  }
}
