import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_booking_app/app_session.dart';
import 'package:flutter_booking_app/services/api_service.dart';
import 'package:flutter_booking_app/services/app_events_service.dart';

import 'edit_profile_screen.dart';
import 'history_screen.dart';
import 'my_appointments_screen.dart';
import 'notifications_screen.dart';
import 'promotions_screen.dart';
import 'settings_screen.dart';
import 'support_screen.dart';
import 'shop_order_history_screen.dart';

String? _accountAvatarUrl(String? stored) {
  return ApiService.resolveMediaUrl(stored);
}

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  late Future<UserProfile?> _profileFuture;
  final _events = AppEventsService.instance;

  @override
  void initState() {
    super.initState();
    _profileFuture = _loadProfile();
  }

  Future<UserProfile?> _loadProfile() async {
    final phone =
        AppSession.phone ?? FirebaseAuth.instance.currentUser?.phoneNumber;
    if (phone == null) return null;
    try {
      final map = await ApiService.getUser(phone);
      final p = UserProfile.fromJson(Map<String, dynamic>.from(map));
      AppSession.setFromUserMap(map);
      return p;
    } catch (_) {
      return null;
    }
  }

  Future<void> _openNotifications() async {
    await Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => const NotificationsScreen()));
  }

  Future<void> _refreshProfile() async {
    final future = _loadProfile();
    setState(() {
      _profileFuture = future;
    });
    await future;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xffffc107),
      body: Column(
        children: [
          _buildHeader(),
          Expanded(
            child: Container(
              color: const Color(0xfff4f5f9),
              child: RefreshIndicator(
                onRefresh: _refreshProfile,
                color: const Color(0xffffc107),
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      FutureBuilder<UserProfile?>(
                        future: _profileFuture,
                        builder: (context, snapshot) {
                          if (snapshot.connectionState ==
                              ConnectionState.waiting) {
                            return const Padding(
                              padding: EdgeInsets.symmetric(vertical: 32),
                              child: Center(child: CircularProgressIndicator()),
                            );
                          }
                          return _buildProfileCard(context, snapshot.data);
                        },
                      ),
                      const SizedBox(height: 16),
                      _buildMenuList(context),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Đang gọi Hotline...'))),
        backgroundColor: const Color(0xffffc107),
        icon: const Icon(Icons.phone, color: Colors.black),
        label: const Text(
          'Hotline',
          style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      color: const Color(0xffffc107),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Center(
              child: Icon(Icons.content_cut, color: Colors.orange, size: 26),
            ),
          ),
          const SizedBox(width: 12),
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'GROUP 5',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              Text('Haircut Booking App', style: TextStyle(fontSize: 12)),
            ],
          ),
          const Spacer(),
          ValueListenableBuilder<List<LocalNotificationItem>>(
            valueListenable: _events.localNotifications,
            builder: (context, _, child) {
              final showDot = _events.unreadNotificationCount > 0;
              return GestureDetector(
                onTap: _openNotifications,
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Stack(
                    children: [
                      const Icon(Icons.notifications_outlined, size: 22),
                      if (showDot)
                        Positioned(
                          right: 0,
                          top: 0,
                          child: Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: Colors.red,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildProfileCard(BuildContext context, UserProfile? profile) {
    final fallback = UserProfile(
      id: AppSession.userId ?? 0,
      fullName: '',
      phone: AppSession.phone ?? '',
    );
    final p = profile ?? fallback;
    final name = p.fullName.isNotEmpty ? p.fullName : 'Chưa cập nhật';
    final phone = p.phone.isNotEmpty ? p.phone : (AppSession.phone ?? '—');
    final avatarUrl = _accountAvatarUrl(p.avatarUrl);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            width: 90,
            height: 90,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0xffffc107), width: 3),
              color: const Color(0xfff5f5f7),
            ),
            child: ClipOval(
              child: avatarUrl != null
                  ? Image.network(
                      avatarUrl,
                      width: 90,
                      height: 90,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) => const Icon(
                        Icons.person,
                        size: 50,
                        color: Colors.grey,
                      ),
                    )
                  : const Icon(Icons.person, size: 50, color: Colors.grey),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            name,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(phone, style: const TextStyle(color: Colors.grey, fontSize: 14)),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: p.id == 0 && profile == null
                ? null
                : () async {
                    await Navigator.push<Map<String, dynamic>?>(
                      context,
                      MaterialPageRoute(
                        builder: (_) => EditProfileScreen(profile: p),
                      ),
                    );
                    if (!mounted) return;
                    setState(() {
                      _profileFuture = _loadProfile();
                    });
                  },
            icon: const Icon(
              Icons.person_outline,
              size: 16,
              color: Colors.grey,
            ),
            label: const Text(
              'Chỉnh sửa',
              style: TextStyle(color: Colors.grey),
            ),
            style: OutlinedButton.styleFrom(
              side: BorderSide(color: Colors.grey.shade300),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMenuList(BuildContext context) {
    final menus = [
      {
        'icon': Icons.calendar_month_outlined,
        'label': 'Đặt Lịch của tôi',
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const MyAppointmentsScreen()),
        ),
      },
      {
        'icon': Icons.history,
        'label': 'Lịch Sử cắt tóc',
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const HistoryScreen()),
        ),
      },
      {
        'icon': Icons.shopping_bag_outlined,
        'label': 'Đơn hàng của tui',
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const ShopOrderHistoryScreen()),
        ),
      },
      {
        'icon': Icons.card_giftcard_outlined,
        'label': 'Ưu đãi',
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const PromotionsScreen()),
        ),
      },
      {
        'icon': Icons.support_agent_outlined,
        'label': 'Hỗ trợ & FAQ',
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const SupportScreen()),
        ),
      },
      {
        'icon': Icons.settings_outlined,
        'label': 'Cài Đặt',
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const SettingsScreen()),
        ),
      },
    ];

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: menus.asMap().entries.map((e) {
          final i = e.key;
          final menu = e.value;
          return Column(
            children: [
              ListTile(
                onTap: menu['onTap'] as VoidCallback,
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xffffc107).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    menu['icon'] as IconData,
                    color: const Color(0xffffa000),
                    size: 22,
                  ),
                ),
                title: Text(
                  menu['label'] as String,
                  style: const TextStyle(fontWeight: FontWeight.w500),
                ),
                trailing: const Icon(Icons.chevron_right, color: Colors.grey),
              ),
              if (i < menus.length - 1)
                Divider(
                  height: 1,
                  indent: 16,
                  endIndent: 16,
                  color: Colors.grey.shade100,
                ),
            ],
          );
        }).toList(),
      ),
    );
  }
}
