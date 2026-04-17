// lib/screens/promotions_screen.dart
import 'package:flutter/material.dart';

import '../services/api_service.dart';

class PromotionsScreen extends StatefulWidget {
  const PromotionsScreen({
    super.key,
    this.selectable = false,
    this.selectedTitle,
  });

  final bool selectable;
  final String? selectedTitle;

  @override
  State<PromotionsScreen> createState() => _PromotionsScreenState();
}

class _PromotionsScreenState extends State<PromotionsScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _offers = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await ApiService.getOffers();
      if (!mounted) return;
      setState(() {
        _offers = list;
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

  String _formatExpire(dynamic raw) {
    if (raw == null) return '—';
    final s = raw.toString();
    if (s.length >= 10) {
      final y = int.tryParse(s.substring(0, 4));
      final m = int.tryParse(s.substring(5, 7));
      final d = int.tryParse(s.substring(8, 10));
      if (y != null && m != null && d != null) {
        return '${d.toString().padLeft(2, '0')}/${m.toString().padLeft(2, '0')}/$y';
      }
    }
    return s;
  }

  Color _colorFromHex(String? hex) {
    var h = hex?.trim();
    if (h == null || h.isEmpty) h = '#FF6B6B';
    if (h.startsWith('#')) h = h.substring(1);
    if (h.length == 6) {
      return Color(int.parse('FF$h', radix: 16));
    }
    return const Color(0xFFFF6B6B);
  }

  /// Chuỗi cho `Color(int.parse(...))` tương thích màn đặt lịch cũ.
  String _colorParseKey(String? hex) {
    var h = hex?.trim();
    if (h == null || h.isEmpty) h = '#FF6B6B';
    if (h.startsWith('#')) h = h.substring(1);
    if (h.length == 6) return '0xFF$h';
    return '0xFFFF6B6B';
  }

  Map<String, String> _asSelectableMap(Map<String, dynamic> p) {
    final title = p['title']?.toString() ?? '';
    final desc = p['description']?.toString() ?? '';
    return {
      'title': title,
      'desc': desc,
      'expire': _formatExpire(p['expires_at']),
      'color': _colorParseKey(p['accent_color']?.toString()),
    };
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xfff4f5f9),
      appBar: AppBar(
        backgroundColor: const Color(0xffffc107),
        title: const Text(
          'Ưu đãi',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        foregroundColor: Colors.black,
        elevation: 0,
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Ưu đãi hiện có',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              if (_loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    'Không tải được ưu đãi: $_error',
                    style: const TextStyle(color: Colors.red),
                  ),
                )
              else if (_offers.isEmpty)
                const Text(
                  'Chưa có ưu đãi nào.',
                  style: TextStyle(color: Colors.black54),
                )
              else
                ..._offers.map((p) {
                  final title = p['title']?.toString() ?? '';
                  final desc = p['description']?.toString() ?? '';
                  final isSelected =
                      widget.selectedTitle != null &&
                      widget.selectedTitle == title;
                  final giftColor = _colorFromHex(p['accent_color']?.toString());

                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: isSelected
                          ? Border.all(
                              color: const Color(0xffffc107),
                              width: 1.5,
                            )
                          : null,
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
                          width: 56,
                          height: 56,
                          decoration: BoxDecoration(
                            color: giftColor,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Icon(
                            Icons.card_giftcard,
                            color: Colors.white,
                            size: 28,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      title,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                  if (isSelected)
                                    const Icon(
                                      Icons.check_circle,
                                      color: Color(0xffffc107),
                                      size: 18,
                                    ),
                                ],
                              ),
                              Text(
                                desc,
                                style: TextStyle(
                                  color: Colors.grey.shade600,
                                  fontSize: 13,
                                ),
                              ),
                              Text(
                                'HSD: ${_formatExpire(p['expires_at'])}',
                                style: const TextStyle(
                                  color: Colors.red,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                        ElevatedButton(
                          onPressed: () {
                            final selected = _asSelectableMap(p);
                            if (widget.selectable) {
                              Navigator.of(context).pop(selected);
                              return;
                            }
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Đã chọn: $title')),
                            );
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xffffc107),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 8,
                            ),
                          ),
                          child: const Text(
                            'Dùng',
                            style: TextStyle(
                              color: Colors.black,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }),
            ],
          ),
        ),
      ),
    );
  }
}
