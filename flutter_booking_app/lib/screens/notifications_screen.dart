import 'package:flutter/material.dart';
import 'package:flutter_booking_app/app_session.dart';
import 'package:flutter_booking_app/services/api_service.dart';
import 'package:flutter_booking_app/services/app_events_service.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final _events = AppEventsService.instance;
  late Future<List<Map<String, dynamic>>> _apiNotificationsFuture;

  @override
  void initState() {
    super.initState();
    _apiNotificationsFuture = _loadApiNotifications();
  }

  Future<List<Map<String, dynamic>>> _loadApiNotifications() async {
    final userId = AppSession.userId;
    if (userId == null) return [];

    final raw = await ApiService.getNotifications(userId);
    return raw.whereType<Map>().map((e) {
      final m = Map<String, dynamic>.from(e);
      m['source'] = 'api';
      return m;
    }).toList();
  }

  Future<void> _markAsRead(Map<String, dynamic> item) async {
    final id = item['id'];
    if (id is! num) return;

    try {
      await ApiService.markNotificationRead(id.toInt());
      if (!mounted) return;
      setState(() {
        item['is_read'] = true;
      });
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Đánh dấu đã đọc thất bại')));
    }
  }

  Future<void> _refresh() async {
    setState(() {
      _apiNotificationsFuture = _loadApiNotifications();
    });
    await _apiNotificationsFuture;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Thông báo'),
        backgroundColor: const Color(0xffffc107),
      ),
      backgroundColor: const Color(0xfff4f5f9),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ValueListenableBuilder<List<LocalNotificationItem>>(
          valueListenable: _events.localNotifications,
          builder: (context, localItems, _) {
            return FutureBuilder<List<Map<String, dynamic>>>(
              future: _apiNotificationsFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting &&
                    localItems.isEmpty) {
                  return const Center(child: CircularProgressIndicator());
                }

                final apiItems =
                    snapshot.data ?? const <Map<String, dynamic>>[];
                final mixed = <Map<String, dynamic>>[
                  ...localItems.map(
                    (e) => {
                      'id': e.id,
                      'title': e.title,
                      'message': e.message,
                      'is_read': e.isRead,
                      'source': 'local',
                    },
                  ),
                  ...apiItems,
                ];

                if (mixed.isEmpty) {
                  return ListView(
                    children: const [
                      SizedBox(height: 140),
                      Center(
                        child: Text(
                          'Bạn chưa có thông báo nào',
                          style: TextStyle(color: Colors.grey),
                        ),
                      ),
                    ],
                  );
                }

                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: mixed.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final item = mixed[index];
                    final title = (item['title'] ?? item['type'] ?? 'Thông báo')
                        .toString();
                    final message = (item['message'] ?? '').toString();
                    final isRead =
                        item['is_read'] == true || item['is_read'] == 1;

                    return ListTile(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      tileColor: Colors.white,
                      leading: CircleAvatar(
                        backgroundColor: isRead
                            ? Colors.grey.shade200
                            : const Color(0xffffc107).withValues(alpha: 0.25),
                        child: Icon(
                          isRead
                              ? Icons.notifications_none
                              : Icons.notifications_active_outlined,
                          color: isRead
                              ? Colors.grey.shade600
                              : const Color(0xffffa000),
                        ),
                      ),
                      title: Text(
                        title,
                        style: TextStyle(
                          fontWeight: isRead
                              ? FontWeight.w500
                              : FontWeight.w700,
                        ),
                      ),
                      subtitle: Text(
                        message,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      trailing: isRead
                          ? const Icon(
                              Icons.done,
                              color: Colors.green,
                              size: 20,
                            )
                          : TextButton(
                              onPressed: () async {
                                if (item['source'] == 'local') {
                                  final id = item['id'];
                                  if (id is num) {
                                    _events.markLocalNotificationRead(
                                      id.toInt(),
                                    );
                                  }
                                  return;
                                }
                                await _markAsRead(item);
                              },
                              child: const Text('Đã đọc'),
                            ),
                    );
                  },
                );
              },
            );
          },
        ),
      ),
    );
  }
}
