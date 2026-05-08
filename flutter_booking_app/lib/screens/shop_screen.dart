import 'package:flutter/material.dart';
import 'package:flutter_booking_app/services/app_events_service.dart';
import 'package:flutter_booking_app/services/api_service.dart';

import 'cart_screen.dart';

class ShopScreen extends StatefulWidget {
  const ShopScreen({super.key});
  @override
  State<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends State<ShopScreen> {
  final _events = AppEventsService.instance;

  static const List<String> _defaultCategoryOrder = [
    'Dầu gội',
    'Sữa tắm',
    'Sáp vuốt tóc',
    'Sữa rửa mặt',
  ];

  int? _selectedCategoryId; // null = "Tất cả"
  String _searchText = '';

  late Future<List<dynamic>> _dataFuture;

  Future<List<dynamic>> _buildDataFuture() {
    return Future.wait([
      ApiService.getProductCategories(),
      ApiService.getProducts(),
    ]);
  }

  Future<void> _refreshShop() async {
    final future = _buildDataFuture();
    setState(() {
      _dataFuture = future;
    });
    await future;
  }

  @override
  void initState() {
    super.initState();
    _dataFuture = _buildDataFuture();
  }

  Future<void> _openCart() async {
    await Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => const CartScreen()));
  }

  String _formatPrice(dynamic raw) {
    final value = raw;
    if (value == null) return '0đ';
    if (value is num) {
      // Remove decimal part if it's .00
      final intValue = value.toInt();
      final separated = intValue.toString().replaceAllMapped(
        RegExp(r'\B(?=(\d{3})+(?!\d))'),
        (m) => '.',
      );
      return '$separatedđ';
    }
    final s = value.toString().trim();
    if (s.isEmpty) return '0đ';
    // Remove .00 if present
    String cleaned = s;
    if (cleaned.contains('.')) {
      var parts = cleaned.split('.');
      // Check if decimal part is .00
      if (parts.length == 2 && (parts[1] == '00' || parts[1] == '0')) {
        cleaned = parts[0];
      }
    }
    // Add thousands separator
    if (cleaned.replaceAll(RegExp(r'[^0-9]'), '').isNotEmpty) {
      final numPart = cleaned.replaceAll(RegExp(r'[^0-9]'), '');
      final separated = numPart.replaceAllMapped(
        RegExp(r'\B(?=(\d{3})+(?!\d))'),
        (m) => '.',
      );
      return cleaned.contains('đ') ? '$separated đ' : '$separatedđ';
    }
    return cleaned.contains('đ') ? cleaned : '$cleaned đ';
  }

  String? _normalizeImageUrl(dynamic stored) {
    return ApiService.resolveMediaUrl(stored?.toString());
  }

  String _normalizeCategoryName(String? v) => v?.trim().toLowerCase() ?? '';

  List<Map<String, dynamic>> _getDefaultDisplayCategories(
    List<Map<String, dynamic>> categories,
  ) {
    final byNormalizedName = <String, Map<String, dynamic>>{};
    for (final c in categories) {
      final nameKey = _normalizeCategoryName(c['name']?.toString());
      if (nameKey.isEmpty) continue;
      byNormalizedName[nameKey] = c;
    }

    return _defaultCategoryOrder
        .map((name) => byNormalizedName[_normalizeCategoryName(name)])
        .whereType<Map<String, dynamic>>()
        .toList(growable: false);
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
                onRefresh: _refreshShop,
                color: const Color(0xffffc107),
                child: FutureBuilder<List<dynamic>>(
                  future: _dataFuture,
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: const [
                          SizedBox(height: 280),
                          Center(child: CircularProgressIndicator()),
                        ],
                      );
                    }
                    if (snapshot.hasError) {
                      return ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.all(16),
                        children: [
                          Text(
                            'Không tải được shop: ${snapshot.error}',
                            style: const TextStyle(color: Colors.grey),
                          ),
                        ],
                      );
                    }

                    final categoriesRaw = snapshot.data?.isNotEmpty == true
                        ? snapshot.data![0] as List<dynamic>
                        : const [];
                    final productsRaw = snapshot.data?.isNotEmpty == true
                        ? snapshot.data![1] as List<dynamic>
                        : const [];

                    final categories = categoriesRaw
                        .map((e) => Map<String, dynamic>.from(e as Map))
                        .toList(growable: false);
                    final products = productsRaw
                        .map((e) => Map<String, dynamic>.from(e as Map))
                        .toList(growable: false);

                    final filtered = products
                        .where((p) {
                          final idRaw = p['category_id'] ?? p['categoryId'];
                          final categoryId = idRaw is int
                              ? idRaw
                              : int.tryParse(idRaw?.toString() ?? '');
                          final matchCategory =
                              _selectedCategoryId == null ||
                              categoryId == _selectedCategoryId;

                          final matchSearch =
                              _searchText.isEmpty ||
                              '${p['name'] ?? ''}'
                                  .toString()
                                  .toLowerCase()
                                  .contains(_searchText.toLowerCase());
                          return matchCategory && matchSearch;
                        })
                        .toList(growable: false);

                    final displayCategories = _getDefaultDisplayCategories(
                      categories,
                    );

                    return SingleChildScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildCategoryList(displayCategories),
                          const SizedBox(height: 16),
                          _buildProductGrid(filtered),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      color: const Color(0xffffc107),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.storefront, size: 28),
              const SizedBox(width: 8),
              const Text(
                'Shop',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
              ),
              const Spacer(),
              ValueListenableBuilder<List<CartEntry>>(
                valueListenable: _events.cartItems,
                builder: (context, _, child) {
                  final showDot = _events.cartCount > 0;
                  return GestureDetector(
                    onTap: _openCart,
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Stack(
                        children: [
                          const Icon(Icons.shopping_cart_outlined, size: 22),
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
          const SizedBox(height: 12),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.06),
                  blurRadius: 8,
                ),
              ],
            ),
            child: TextField(
              onChanged: (v) => setState(() => _searchText = v),
              decoration: InputDecoration(
                hintText: 'Tìm sản phẩm...',
                prefixIcon: const Icon(Icons.search, color: Color(0xffffc107)),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryList(List<Map<String, dynamic>> categories) {
    return SizedBox(
      height: 38,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: categories.length + 1,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final isAll = i == 0;
          final category = isAll ? null : categories[i - 1];
          final idRaw = category?['id'];
          final id = idRaw is int
              ? idRaw
              : int.tryParse(idRaw?.toString() ?? '');
          final selected = isAll
              ? _selectedCategoryId == null
              : _selectedCategoryId == id;
          return GestureDetector(
            onTap: () =>
                setState(() => _selectedCategoryId = isAll ? null : id),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: selected ? const Color(0xffffc107) : Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 6,
                  ),
                ],
              ),
              child: Text(
                isAll ? 'Tất cả' : (category?['name']?.toString() ?? '---'),
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: selected ? Colors.black : Colors.grey.shade600,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildProductGrid(List<Map<String, dynamic>> products) {
    if (products.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(40),
          child: Text(
            'Không tìm thấy sản phẩm',
            style: TextStyle(color: Colors.grey),
          ),
        ),
      );
    }
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 0.78,
      ),
      itemCount: products.length,
      itemBuilder: (context, i) => _buildProductCard(products[i]),
    );
  }

  Widget _buildProductCard(Map<String, dynamic> product) {
    final imageUrl = _normalizeImageUrl(
      product['image_url'] ?? product['imageUrl'],
    );

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 110,
            decoration: BoxDecoration(
              color: const Color(0xfff5f5f7),
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(18),
              ),
            ),
            child: Center(
              child: ClipRRect(
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(18),
                ),
                child: imageUrl == null
                    ? const Icon(
                        Icons.image_outlined,
                        size: 52,
                        color: Color(0xffffc107),
                      )
                    : Image.network(
                        imageUrl,
                        width: double.infinity,
                        height: 110,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) =>
                            const Icon(
                              Icons.broken_image_outlined,
                              size: 52,
                              color: Color(0xffffc107),
                            ),
                      ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${product['name'] ?? '---'}',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Text(
                  'Tồn: ${product['stock'] ?? 0} ${product['unit'] ?? ''}'
                      .toString()
                      .trim(),
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      _formatPrice(product['price']),
                      style: const TextStyle(
                        color: Color(0xffffc107),
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                    GestureDetector(
                      onTap: () {
                        final name = (product['name'] ?? '').toString();
                        final price = AppEventsService.parseMoney(
                          (product['price'] ?? '').toString(),
                        );
                        _events.addToCart(name: name, price: price);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Đã thêm $name vào giỏ'),
                            duration: const Duration(seconds: 1),
                          ),
                        );
                      },
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: const Color(0xffffc107),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          Icons.add,
                          size: 16,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
