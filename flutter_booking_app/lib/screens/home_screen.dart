import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'booking_screen.dart';
import 'commitment_screen.dart';
import 'history_screen.dart';
import 'promotions_screen.dart';
import 'shop_screen.dart';
import 'support_screen.dart';
import 'account_screen.dart';
import '../services/api_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;
  static const _bottomLabels = [
    'Trang chủ',
    'Shop',
    'Đặt lịch',
    'Lịch sử',
    'Tài khoản',
  ];
  static const _bottomIcons = [
    Icons.home,
    Icons.storefront,
    Icons.calendar_today,
    Icons.history,
    Icons.person,
  ];

  void _onTap(int index) => setState(() => _selectedIndex = index);

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        statusBarColor: const Color(0xffffc107),
      ),
      child: Scaffold(
        backgroundColor: const Color(0xffffc107),
        body: SafeArea(
          child: IndexedStack(
            index: _selectedIndex,
            children: [
              HomeTab(onOpenShop: () => _onTap(1)),
              const ShopScreen(),
              BookingScreen(),
              HistoryScreen(),
              AccountScreen(),
            ],
          ),
        ),
        bottomNavigationBar: BottomNavigationBar(
          type: BottomNavigationBarType.fixed,
          currentIndex: _selectedIndex,
          selectedItemColor: const Color(0xffffc107),
          unselectedItemColor: Colors.grey,
          onTap: _onTap,
          items: List.generate(
            _bottomLabels.length,
            (index) => BottomNavigationBarItem(
              icon: Icon(_bottomIcons[index]),
              label: _bottomLabels[index],
            ),
          ),
        ),
      ),
    );
  }
}

class HomeTab extends StatefulWidget {
  const HomeTab({super.key, required this.onOpenShop});

  /// Chuyển sang tab Shop (index 1) thay vì mở trang mới.
  final VoidCallback onOpenShop;

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  Future<void> _refreshHome() async {
    await ApiService.getServices();
    if (!mounted) return;
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const _HomeHeader(),
        Expanded(
          child: Container(
            color: const Color(0xfff4f5f9),
            child: RefreshIndicator(
              onRefresh: _refreshHome,
              color: const Color(0xffffc107),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                // Giảm padding dưới để danh sách service "gần chạm" bottom navigation hơn.
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _ActionGrid(onOpenShop: widget.onOpenShop),
                    const SizedBox(height: 16),
                    const _RatingCard(),
                    const SizedBox(height: 18),
                    const Text(
                      'DỊCH VỤ TÓC',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    const _ServiceList(),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _HomeHeader extends StatelessWidget {
  const _HomeHeader();
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: const Color(0xffffc107),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Center(
                  child: Icon(
                    Icons.content_cut,
                    color: Colors.orange,
                    size: 26,
                  ),
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
            ],
          ),
          const SizedBox(height: 18),
          const Text(
            'Chào mừng! Chọn dịch vụ và đặt lịch nhanh chóng.',
            style: TextStyle(color: Colors.black87),
          ),
        ],
      ),
    );
  }
}

class _ActionGrid extends StatelessWidget {
  const _ActionGrid({required this.onOpenShop});

  final VoidCallback onOpenShop;

  static const _actions = [
    _ActionItem(icon: Icons.local_offer, label: 'Ưu đãi'),
    _ActionItem(icon: Icons.verified, label: 'Cam kết'),
    _ActionItem(icon: Icons.store, label: 'Shop'),
    _ActionItem(icon: Icons.phone_in_talk, label: 'Hỗ trợ'),
  ];

  void _onTap(BuildContext context, int index) {
    switch (index) {
      case 0:
        Navigator.of(
          context,
        ).push(MaterialPageRoute(builder: (_) => const PromotionsScreen()));
        break;
      case 1:
        Navigator.of(
          context,
        ).push(MaterialPageRoute(builder: (_) => const CommitmentScreen()));
        break;
      case 2:
        onOpenShop();
        break;
      case 3:
        Navigator.of(
          context,
        ).push(MaterialPageRoute(builder: (_) => const SupportScreen()));
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 12,
            offset: const Offset(0, 7),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: List.generate(_actions.length, (i) {
          final action = _actions[i];
          return InkWell(
            onTap: () => _onTap(context, i),
            borderRadius: BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: const Color(0xffffc107),
                    child: Icon(action.icon, size: 26, color: Colors.white),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    action.label,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          );
        }),
      ),
    );
  }
}

class _ActionItem {
  final IconData icon;
  final String label;
  const _ActionItem({required this.icon, required this.label});
}

class _RatingCard extends StatelessWidget {
  const _RatingCard();
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 14,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: const Color(0xffffc107),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Center(
              child: Icon(Icons.person, size: 34, color: Colors.white),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Mời anh chị đánh giá chất lượng phục vụ',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Row(
                  children: List.generate(
                    5,
                    (i) => const Icon(
                      Icons.star,
                      color: Color(0xffffc107),
                      size: 20,
                    ),
                  ),
                ),
              ],
            ),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => const HistoryScreen(initialTab: 1),
              ),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xffffc107),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            child: const Text('Đánh giá'),
          ),
        ],
      ),
    );
  }
}

class _ServiceList extends StatelessWidget {
  const _ServiceList();

  static const double _cardHeight = 290;

  String _formatPrice(dynamic raw) {
    if (raw == null) return '';
    final s = raw.toString().trim();
    if (s.isEmpty) return '';
    final cleaned = s.replaceAll(',', '');
    final n = double.tryParse(cleaned);
    if (n == null) return s;
    if (n >= 1000000) {
      final v = n / 1000000;
      final fixed = (v % 1 == 0) ? v.toStringAsFixed(0) : v.toStringAsFixed(1);
      return '${fixed}tr';
    }
    if (n >= 1000) {
      final v = n / 1000;
      final fixed = (v % 1 == 0) ? v.toStringAsFixed(0) : v.toStringAsFixed(1);
      return '${fixed}k';
    }
    return '${n.round()}đ';
  }

  String _normalizeImageUrl(String? u) {
    return ApiService.resolveMediaUrl(u) ?? '';
  }

  IconData _iconForServiceName(String name) {
    final n = name.toLowerCase();
    if (n.contains('uốn') || n.contains('uon')) return Icons.auto_fix_high;
    if (n.contains('nhuộm') || n.contains('nhom')) return Icons.color_lens;
    if (n.contains('gội') || n.contains('goi')) return Icons.shower;
    return Icons.content_cut;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<dynamic>>(
      future: ApiService.getServices(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return SizedBox(
            height: _cardHeight,
            child: const Center(child: CircularProgressIndicator()),
          );
        }
        if (snapshot.hasError) {
          return SizedBox(
            height: _cardHeight,
            child: Center(
              child: Text('Không tải được dịch vụ: ${snapshot.error}'),
            ),
          );
        }

        final raw = snapshot.data ?? const <dynamic>[];
        final services = raw
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            // Yêu cầu "Sản phẩm phải có ảnh": chỉ giữ item có image_url hợp lệ.
            .where((s) {
              final imageUrl = _normalizeImageUrl(s['image_url']?.toString());
              return imageUrl.isNotEmpty;
            })
            .toList(growable: false);

        if (services.isEmpty) {
          return SizedBox(
            height: _cardHeight,
            child: const Center(child: Text('Chưa có dịch vụ')),
          );
        }

        return SizedBox(
          height: _cardHeight,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: services.length,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final s = services[index];
              final name = s['name']?.toString() ?? '';
              final priceText = _formatPrice(s['price']);
              final description = s['description']?.toString() ?? '';
              final imageUrl = _normalizeImageUrl(s['image_url']?.toString());
              return _ServiceItem(
                title: name,
                price: priceText,
                icon: _iconForServiceName(name),
                height: _cardHeight,
                description: description,
                imageUrl: imageUrl,
              );
            },
          ),
        );
      },
    );
  }
}

class _ServiceItem extends StatelessWidget {
  final String title, price, description, imageUrl;
  final IconData icon;
  final double height;
  const _ServiceItem({
    required this.title,
    required this.price,
    required this.icon,
    required this.height,
    required this.description,
    required this.imageUrl,
  });
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 200,
      height: height,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 12,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.max,
        mainAxisAlignment: MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 90,
            decoration: BoxDecoration(
              color: const Color(0xfff5f5f7),
              borderRadius: BorderRadius.circular(16),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: imageUrl.isEmpty
                  ? Center(
                      child: Icon(
                        icon,
                        size: 42,
                        color: Colors.deepPurple.shade700,
                      ),
                    )
                  : Image.network(
                      imageUrl,
                      fit: BoxFit.cover,
                      width: double.infinity,
                      height: double.infinity,
                      loadingBuilder: (context, child, progress) {
                        if (progress == null) return child;
                        return const Center(
                          child: SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(strokeWidth: 3),
                          ),
                        );
                      },
                      errorBuilder: (context, error, stackTrace) {
                        return Center(
                          child: Icon(
                            icon,
                            size: 42,
                            color: Colors.deepPurple.shade700,
                          ),
                        );
                      },
                    ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          Text(price, style: TextStyle(color: Colors.grey.shade700)),
          const SizedBox(height: 10),
          Text(
            description.trim().isEmpty ? 'Chưa có mô tả' : description.trim(),
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: Colors.grey.shade700, fontSize: 12.5),
          ),
        ],
      ),
    );
  }
}
