import 'package:flutter/material.dart';
import 'package:flutter_booking_app/services/api_service.dart';

class ShopOrderDetailScreen extends StatefulWidget {
  const ShopOrderDetailScreen({super.key, required this.orderId});

  final int orderId;

  @override
  State<ShopOrderDetailScreen> createState() => _ShopOrderDetailScreenState();
}

class _ShopOrderDetailScreenState extends State<ShopOrderDetailScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _order;
  List<Map<String, dynamic>> _items = const [];

  @override
  void initState() {
    super.initState();
    _loadOrderDetail();
  }

  Future<void> _loadOrderDetail() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final result = await ApiService.getShopOrderDetail(
        orderId: widget.orderId,
      );
      if (!mounted) return;
      setState(() {
        _order = result['order'] as Map<String, dynamic>?;
        _items = List<Map<String, dynamic>>.from(
          result['items'] as List<dynamic>,
        );
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  String _formatMoney(dynamic value) {
    final raw = value?.toString() ?? '';
    final amount = int.tryParse(raw.split('.').first) ?? 0;
    return '${amount.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => '.')}đ';
  }

  String _statusLabel(String status) {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'Đang chờ xử lý';
      case 'confirmed':
        return 'Đã xác nhận';
      case 'shipping':
        return 'Đang giao';
      case 'delivered':
        return 'Đã giao';
      case 'completed':
        return 'Hoàn thành';
      case 'cancelled':
        return 'Đã hủy';
      default:
        return status;
    }
  }

  String _formatDate(String? raw) {
    final dt = DateTime.tryParse(raw ?? '');
    if (dt == null) return raw ?? '';
    return '${dt.day}/${dt.month}/${dt.year} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chi tiết đơn hàng'),
        backgroundColor: const Color(0xffffc107),
        foregroundColor: Colors.black,
      ),
      backgroundColor: const Color(0xfff4f5f9),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xffffc107)),
            )
          : _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'Lỗi tải đơn hàng: $_error',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.black87, fontSize: 15),
                ),
              ),
            )
          : _buildContent(),
    );
  }

  Widget _buildContent() {
    final order = _order ?? {};
    final status = order['status']?.toString() ?? '';
    final createdAt = _formatDate(order['created_at']?.toString());
    final totalPrice = _formatMoney(order['total_price']);
    final branchName = order['branch_name']?.toString();
    final shippingAddress = order['shipping_address']?.toString();
    final note = order['note']?.toString();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Material(
          borderRadius: BorderRadius.circular(16),
          color: Colors.white,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Đơn #${order['id'] ?? '---'}',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.05),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        _statusLabel(status),
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (createdAt.isNotEmpty)
                  Text(
                    createdAt,
                    style: const TextStyle(color: Colors.black54, fontSize: 13),
                  ),
                if (branchName?.isNotEmpty == true) ...[
                  const SizedBox(height: 10),
                  Text(
                    'Chi nhánh: $branchName',
                    style: const TextStyle(fontSize: 14),
                  ),
                ],
                if (shippingAddress?.isNotEmpty == true) ...[
                  const SizedBox(height: 10),
                  const Text(
                    'Địa chỉ nhận hàng',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 4),
                  Text(shippingAddress!, style: const TextStyle(fontSize: 13)),
                ],
                const SizedBox(height: 16),
                const Text(
                  'Danh sách sản phẩm',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 12),
                ..._items.map((item) => _buildItemRow(item)),
                const SizedBox(height: 16),
                Row(
                  children: [
                    const Text(
                      'Tổng tiền',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      totalPrice,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Color(0xffffa000),
                      ),
                    ),
                  ],
                ),
                if (note?.trim().isNotEmpty == true) ...[
                  const SizedBox(height: 16),
                  const Text(
                    'Ghi chú đơn hàng',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(note!, style: const TextStyle(fontSize: 13)),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildItemRow(Map<String, dynamic> item) {
    final name =
        item['product_name']?.toString() ??
        item['name']?.toString() ??
        'Sản phẩm';
    final quantity = item['quantity']?.toString() ?? '0';
    final unitPrice = _formatMoney(item['unit_price']);
    final subtotal = _formatMoney(item['subtotal']);

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text(
                  'Số lượng: $quantity',
                  style: const TextStyle(fontSize: 13, color: Colors.black54),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                subtotal,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 4),
              Text(
                unitPrice,
                style: const TextStyle(fontSize: 12, color: Colors.black45),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
