import 'package:flutter/material.dart';
import 'package:flutter_booking_app/app_session.dart';
import 'package:flutter_booking_app/services/api_service.dart';
import 'shop_order_detail_screen.dart';

class ShopOrderHistoryScreen extends StatefulWidget {
  const ShopOrderHistoryScreen({super.key});

  @override
  State<ShopOrderHistoryScreen> createState() => _ShopOrderHistoryScreenState();
}

class _ShopOrderHistoryScreenState extends State<ShopOrderHistoryScreen> {
  List<Map<String, dynamic>> _orders = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadOrders();
  }

  Future<void> _loadOrders({bool silent = false}) async {
    final customerId = AppSession.userId ?? 0;
    if (customerId <= 0) {
      if (!mounted) return;
      setState(() {
        _orders = const [];
        _loading = false;
        _error = 'Không xác định được khách hàng.';
      });
      return;
    }

    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    try {
      final orders = await ApiService.getShopOrders(customerId: customerId);
      if (!mounted) return;
      setState(() {
        _orders = orders;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _orders = const [];
        _loading = false;
        _error = e.toString();
      });
    }
  }

  String _formatMoney(dynamic value) {
    final raw = value?.toString() ?? '';
    final amount = int.tryParse(raw.split('.').first) ?? 0;
    return '${amount.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => '.')}đ';
  }

  String _formatDate(String? raw) {
    final dt = DateTime.tryParse(raw ?? '');
    if (dt == null) return raw ?? '';
    return '${dt.day}/${dt.month}/${dt.year} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return Colors.blue.shade700;
      case 'shipping':
        return Colors.orange.shade700;
      case 'delivered':
        return Colors.green.shade700;
      case 'completed':
        return Colors.green.shade700;
      case 'cancelled':
        return Colors.red.shade700;
      default:
        return Colors.grey.shade700;
    }
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

  List<String> _extractNoteLines(String? note) {
    if (note == null || note.trim().isEmpty) return const [];
    return note
        .trim()
        .split('\n')
        .where((line) => line.trim().isNotEmpty)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Đơn hàng của tui'),
        backgroundColor: const Color(0xffffc107),
        foregroundColor: Colors.black,
      ),
      backgroundColor: const Color(0xfff4f5f9),
      body: RefreshIndicator(
        onRefresh: () => _loadOrders(silent: true),
        color: const Color(0xffffc107),
        child: Builder(
          builder: (context) {
            if (_loading) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(height: 220),
                  Center(
                    child: CircularProgressIndicator(color: Color(0xffffc107)),
                  ),
                ],
              );
            }

            if (_error != null) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(24),
                children: [
                  Text(
                    'Không tải được đơn hàng: $_error',
                    style: TextStyle(color: Colors.grey.shade800, fontSize: 15),
                    textAlign: TextAlign.center,
                  ),
                ],
              );
            }

            if (_orders.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(vertical: 80),
                children: const [
                  Center(
                    child: Text(
                      'Bạn chưa có đơn hàng nào.',
                      style: TextStyle(fontSize: 16, color: Colors.black54),
                    ),
                  ),
                ],
              );
            }

            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              itemCount: _orders.length,
              separatorBuilder: (context, index) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final order = _orders[index];
                final status = order['status']?.toString() ?? '';
                final createdAt = _formatDate(order['created_at']?.toString());
                final totalPrice = _formatMoney(order['total_price']);
                final branchName = order['branch_name']?.toString();
                final noteLines = _extractNoteLines(order['note']?.toString());
                final shippingAddress = order['shipping_address']?.toString();

                return Material(
                  borderRadius: BorderRadius.circular(16),
                  color: Colors.white,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () {
                      final orderId =
                          int.tryParse(order['id']?.toString() ?? '0') ?? 0;
                      if (orderId > 0) {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) =>
                                ShopOrderDetailScreen(orderId: orderId),
                          ),
                        );
                      }
                    },
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
                                    fontWeight: FontWeight.bold,
                                    fontSize: 16,
                                  ),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  color: _statusColor(
                                    status,
                                  ).withValues(alpha: 0.14),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  _statusLabel(status),
                                  style: TextStyle(
                                    color: _statusColor(status),
                                    fontWeight: FontWeight.w700,
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          if (createdAt.isNotEmpty)
                            Text(
                              createdAt,
                              style: const TextStyle(
                                fontSize: 13,
                                color: Colors.black54,
                              ),
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
                            Text(
                              'Địa chỉ nhận hàng',
                              style: TextStyle(
                                fontSize: 13,
                                color: Colors.grey.shade700,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              shippingAddress!,
                              style: const TextStyle(fontSize: 13),
                            ),
                          ],
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              const Text(
                                'Tổng tiền',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const Spacer(),
                              Text(
                                totalPrice,
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xffffa000),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: const [
                              Text(
                                'Xem chi tiết',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: Color(0xFF003366),
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                          if (noteLines.isNotEmpty) ...[
                            const Divider(height: 24),
                            const Text(
                              'Nội dung đơn hàng',
                              style: TextStyle(fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 8),
                            ...noteLines.map(
                              (line) => Padding(
                                padding: const EdgeInsets.only(bottom: 4),
                                child: Text(
                                  line,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    color: Colors.black87,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
