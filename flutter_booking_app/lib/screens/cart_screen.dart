import 'package:flutter/material.dart';
import 'package:flutter_booking_app/screens/cart_checkout_screen.dart';
import 'package:flutter_booking_app/services/app_events_service.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  final _events = AppEventsService.instance;

  String _formatMoney(int amount) {
    final formatted = amount.toString().replaceAllMapped(
      RegExp(r'\B(?=(\d{3})+(?!\d))'),
      (m) => '.',
    );
    return '$formattedđ';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Giỏ hàng'),
        backgroundColor: const Color(0xffffc107),
      ),
      body: ValueListenableBuilder<List<CartEntry>>(
        valueListenable: _events.cartItems,
        builder: (context, items, _) {
          final total = items.fold<int>(
            0,
            (sum, item) => sum + item.price * item.quantity,
          );
          if (items.isEmpty) {
            return const Center(
              child: Text(
                'Giỏ hàng đang trống',
                style: TextStyle(fontSize: 16, color: Colors.grey),
              ),
            );
          }
          return Column(
            children: [
              Expanded(
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final item = items[index];
                    return Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.05),
                            blurRadius: 8,
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: const Color(
                                0xffffc107,
                              ).withValues(alpha: 0.18),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(
                              Icons.shopping_bag_outlined,
                              color: Color(0xffffa000),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.name,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  _formatMoney(item.price),
                                  style: const TextStyle(
                                    color: Color(0xffffa000),
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Row(
                            children: [
                              IconButton(
                                onPressed: () =>
                                    _events.decreaseQuantity(index),
                                icon: const Icon(Icons.remove_circle_outline),
                              ),
                              Text('${item.quantity}'),
                              IconButton(
                                onPressed: () =>
                                    _events.increaseQuantity(index),
                                icon: const Icon(Icons.add_circle_outline),
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
              Container(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
                decoration: const BoxDecoration(color: Colors.white),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Tổng: ${_formatMoney(total)}',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    ElevatedButton(
                      onPressed: items.isEmpty
                          ? null
                          : () {
                              Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) => const CartCheckoutScreen(),
                                ),
                              );
                            },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xffffc107),
                      ),
                      child: const Text('Tiếp tục đặt hàng'),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
      backgroundColor: const Color(0xfff4f5f9),
    );
  }
}
