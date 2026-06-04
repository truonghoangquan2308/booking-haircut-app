import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_booking_app/app_session.dart';
import 'package:flutter_booking_app/screens/edit_profile_screen.dart';
import 'package:flutter_booking_app/screens/settings_screen.dart';
import 'package:flutter_booking_app/services/api_service.dart';
import 'package:flutter_booking_app/services/barber_notifications_service.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_booking_app/core/theme/app_theme.dart';

import 'customer_reviews_screen.dart';
import 'barber_notifications_screen.dart';

String? _barberAvatarUrl(String? stored, {int? cacheKey}) {
  final raw = ApiService.resolveMediaUrl(stored);
  if (raw == null || raw.isEmpty) return null;
  if (cacheKey == null) return raw;
  final joiner = raw.contains('?') ? '&' : '?';
  return '$raw${joiner}v=$cacheKey';
}

class _BarberAccountSnapshot {
  final UserProfile? profile;
  final String branchLabel;
  final bool isAssigned;
  final String? barberBio;

  _BarberAccountSnapshot({
    required this.profile,
    required this.branchLabel,
    this.isAssigned = false,
    this.barberBio,
  });
}

/// Barber account — layout similar to [AccountScreen], menu tailored for barbers.
class BarberAccountScreen extends StatefulWidget {
  const BarberAccountScreen({super.key});

  @override
  State<BarberAccountScreen> createState() => _BarberAccountScreenState();
}

class _BarberAccountScreenState extends State<BarberAccountScreen> {
  late Future<_BarberAccountSnapshot?> _accountFuture;
  final _notifications = BarberNotificationsService.instance;

  @override
  void initState() {
    super.initState();
    _accountFuture = _loadAccount();
  }

  Future<_BarberAccountSnapshot?> _loadAccount() async {
    final phone =
        AppSession.phone ?? FirebaseAuth.instance.currentUser?.phoneNumber;
    if (phone == null) return null;
    try {
      final map = await ApiService.getUser(phone);
      final p = UserProfile.fromJson(Map<String, dynamic>.from(map));
      AppSession.setFromUserMap(map);

      // load API notifications for barber so unread badge updates
      try {
        if (p.id > 0) {
          await _notifications.load(p.id);
        }
      } catch (_) {}

      var branchLabel = 'chưa thêm';
      var isAssigned = false;
      String? barberBio;
      final uid = p.id;
      if (uid > 0) {
        int? bid;
        try {
          final barber = await ApiService.getBarberByUserId(uid);
          isAssigned = true;
          barberBio = (barber['bio']?.toString() ?? '').trim();
          final b = (barber['branch_id'] as num?)?.toInt();
          if (b != null && b > 0) bid = b;
        } catch (_) {}
        if (bid == null || bid <= 0) {
          final raw = map['branch_id'];
          if (raw is num) bid = raw.toInt();
        }
        if (bid != null && bid > 0) {
          try {
            final branches = await ApiService.getBranches();
            var found = false;
            for (final br in branches) {
              final id = (br['id'] as num?)?.toInt();
              if (id == bid) {
                final n = br['name']?.toString().trim();
                branchLabel = (n != null && n.isNotEmpty)
                    ? n
                    : 'Chi nhánh #$bid';
                found = true;
                break;
              }
            }
            if (!found) branchLabel = 'Chi nhánh #$bid';
          } catch (_) {
            branchLabel = 'Chi nhánh #$bid';
          }
        }
      }

      return _BarberAccountSnapshot(
        profile: p,
        branchLabel: branchLabel,
        isAssigned: isAssigned,
        barberBio: barberBio,
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> _logout() async {
    await FirebaseAuth.instance.signOut();
    AppSession.clear();
    if (!mounted) return;
    Navigator.of(context).pushNamedAndRemoveUntil('/login', (route) => false);
  }

  Future<void> _openNotifications() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const BarberNotificationsScreen()),
    );
  }

  Future<void> _refreshAccount() async {
    final future = _loadAccount();
    setState(() => _accountFuture = future);
    await future;
  }

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      color: const Color(0xffffc107),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
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
              child: Icon(Icons.person, color: Color(0xffffc107), size: 28),
            ),
          ),
          const SizedBox(width: 12),
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Tài khoản',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              Text('Thông tin cá nhân', style: TextStyle(fontSize: 12)),
            ],
          ),
          const Spacer(),
          ValueListenableBuilder<List<BarberNotificationItem>>(
            valueListenable: _notifications.notifications,
            builder: (context, _, child) {
              final showDot = _notifications.unreadCount > 0;
              return GestureDetector(
                onTap: _openNotifications,
                child: Container(
                  margin: const EdgeInsets.only(right: 8),
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.primaryColor,
      body: Column(
        children: [
          _buildHeader(),
          Expanded(
            child: Container(
              color: const Color(0xfff4f5f9),
              child: RefreshIndicator(
                onRefresh: _refreshAccount,
                color: const Color(0xffffc107),
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      FutureBuilder<_BarberAccountSnapshot?>(
                        future: _accountFuture,
                        builder: (context, snapshot) {
                          if (snapshot.connectionState ==
                              ConnectionState.waiting) {
                            return const Padding(
                              padding: EdgeInsets.symmetric(vertical: 32),
                              child: Center(
                                child: CircularProgressIndicator(
                                  color: Color(0xffffc107),
                                ),
                              ),
                            );
                          }
                          final data = snapshot.data;
                          return _buildProfileCard(
                            context,
                            data?.profile,
                            data?.branchLabel ?? 'chưa thêm',
                            data?.isAssigned ?? false,
                            data?.barberBio,
                          );
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
    );
  }

  Widget _buildProfileCard(
    BuildContext context,
    UserProfile? profile,
    String branchLabel,
    bool isAssigned,
    String? barberBio,
  ) {
    final fallback = UserProfile(
      id: AppSession.userId ?? 0,
      fullName: AppSession.fullName ?? '',
      phone: AppSession.phone ?? '',
      avatarUrl: AppSession.avatarUrl,
      role: AppSession.role ?? 'barber',
    );
    final p = profile ?? fallback;
    final name = p.fullName.isNotEmpty ? p.fullName : 'Chưa cập nhật';
    final phone = p.phone.isNotEmpty ? p.phone : (AppSession.phone ?? '—');
    final avatarUrl = _barberAvatarUrl(
      p.avatarUrl,
      cacheKey: AppSession.profileVersion,
    );

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
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.phone, size: 14, color: Colors.grey),
              const SizedBox(width: 6),
              Text(
                phone,
                style: const TextStyle(color: Colors.grey, fontSize: 14),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xffffc107).withAlpha((0.2 * 255).round()),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              isAssigned
                  ? (barberBio != null && barberBio.isNotEmpty
                        ? barberBio
                        : 'Barber')
                  : 'Chưa được cấp',
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            ),
          ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text(
              'Chi nhánh: $branchLabel',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: Colors.grey.shade700,
                height: 1.35,
              ),
            ),
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: p.id == 0 && profile == null
                ? null
                : () async {
                    final updated = await Navigator.push<Map<String, dynamic>?>(
                      context,
                      MaterialPageRoute(
                        builder: (_) => EditProfileScreen(profile: p),
                      ),
                    );
                    if (!mounted) return;
                    if (updated != null) {
                      AppSession.setFromUserMap(updated);
                    }
                    setState(() => _accountFuture = _loadAccount());
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
    final menus = <Map<String, Object>>[
      {
        'icon': Icons.notifications_outlined,
        'label': 'Thông báo',
        'color': Colors.blue,
        'onTap': _openNotifications,
      },
      {
        'icon': Icons.receipt_long_outlined,
        'label': 'Lịch sử thu nhập',
        'color': Colors.green,
        'onTap': () => ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Xem chi tiết ở tab Lịch sử')),
        ),
      },
      {
        'icon': Icons.star_outline_rounded,
        'label': 'Đánh giá của khách',
        'color': Colors.amber,
        'onTap': () => Navigator.push(
          context,
          CupertinoPageRoute(builder: (_) => const CustomerReviewsScreen()),
        ),
      },
      {
        'icon': Icons.settings_outlined,
        'label': 'Cài đặt',
        'color': Colors.grey,
        'onTap': () => Navigator.push(
          context,
          CupertinoPageRoute(builder: (_) => const SettingsScreen()),
        ),
      },
      {
        'icon': Icons.logout_rounded,
        'label': 'Đăng xuất',
        'color': Colors.red,
        'onTap': _logout,
        'danger': true,
      },
    ];

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppTheme.cardRadius,
      ),
      child: Column(
        children: menus.asMap().entries.map((e) {
          final i = e.key;
          final menu = e.value;
          final danger = menu['danger'] == true;
          return Column(
            children: [
              _MenuTile(
                icon: menu['icon'] as IconData,
                label: menu['label'] as String,
                labelColor: danger ? Colors.red : null,
                iconColor: menu['color'] as Color,
                onTap: menu['onTap'] as VoidCallback,
                showChevron: !(danger),
              ),
              if (i < menus.length - 1)
                const Divider(
                  height: 1,
                  indent: 16,
                  endIndent: 16,
                  color: Color(0xFFF3F4F6),
                ),
            ],
          );
        }).toList(),
      ),
    );
  }
}

class _MenuTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color? labelColor;
  final Color iconColor;
  final VoidCallback onTap;
  final bool showChevron;

  const _MenuTile({
    required this.icon,
    required this.label,
    this.labelColor,
    required this.iconColor,
    required this.onTap,
    this.showChevron = true,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: ListTile(
        leading: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: iconColor.withAlpha((0.1 * 255).round()),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: iconColor, size: 18),
        ),
        title: Text(
          label,
          style: TextStyle(fontWeight: FontWeight.w500, color: labelColor),
        ),
        trailing: showChevron
            ? const Icon(Icons.chevron_right, color: Color(0xFF9CA3AF))
            : null,
      ),
    );
  }
}
