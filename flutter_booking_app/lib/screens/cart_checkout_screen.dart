import 'package:firebase_auth/firebase_auth.dart';
import 'dart:async';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_booking_app/app_session.dart';
import 'package:flutter_booking_app/services/api_service.dart';
import 'package:flutter_booking_app/services/app_events_service.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';

/// Màn chi tiết đặt hàng: họ tên, SĐT, mô tả, chọn chi nhánh nhận hàng → POST /api/shop/checkout
class CartCheckoutScreen extends StatefulWidget {
  const CartCheckoutScreen({super.key});

  @override
  State<CartCheckoutScreen> createState() => _CartCheckoutScreenState();
}

class _CartCheckoutScreenState extends State<CartCheckoutScreen> {
  final _events = AppEventsService.instance;
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _noteCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();

  List<Map<String, dynamic>> _branches = [];
  bool _loadingBranches = false;
  String? _branchesError;
  bool _findingNearest = false;
  int? _selectedBranchIndex;

  bool get _branchChosen => _selectedBranchIndex != null;

  bool _submitting = false;
  bool _wantInvoice = false;

  String _formatMoney(int amount) {
    return '${amount.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => '.')}đ';
  }

  @override
  void initState() {
    super.initState();
    _nameCtrl.text = AppSession.fullName ?? '';
    _phoneCtrl.text = AppSession.phone ?? '';
    _fetchBranches();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _noteCtrl.dispose();
    _addressCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final items = _events.cartItems.value;
    if (items.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Giỏ hàng đang trống')));
      return;
    }
    final name = _nameCtrl.text.trim();
    final phone = _phoneCtrl.text.trim();
    final address = _addressCtrl.text.trim();

    if (name.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Nhập họ tên')));
      return;
    }
    if (phone.length < 9) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Nhập số điện thoại hợp lệ')),
      );
      return;
    }
    if (address.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Nhập địa chỉ người nhận')));
      return;
    }
    if (_branches.isNotEmpty && !_branchChosen) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng chọn chi nhánh nhận hàng')),
      );
      return;
    }

    final branchId = _branchChosen && _selectedBranchIndex != null
        ? _branchIdFromMap(_branches[_selectedBranchIndex!])
        : 0;
    if (branchId <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng chọn chi nhánh nhận hàng')),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      final payload = items
          .map(
            (e) => {
              'name': e.name,
              'unit_price': e.price,
              'quantity': e.quantity,
            },
          )
          .toList(growable: false);
      await ApiService.shopCheckout(
        fullName: name,
        phone: phone,
        note: _noteCtrl.text.trim(),
        address: address,
        wantInvoice: _wantInvoice,
        items: payload,
        branchId: branchId,
        firebaseUid: FirebaseAuth.instance.currentUser?.uid,
      );
      _events.clearCart();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Đặt hàng thành công — cửa hàng sẽ xử lý đơn.'),
        ),
      );
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Widget _buildStep(String number, String title) {
    return Row(
      children: [
        CircleAvatar(
          radius: 14,
          backgroundColor: const Color(0xffffc107),
          child: Text(
            number,
            style: const TextStyle(
              fontWeight: FontWeight.bold,
              color: Colors.black,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Text(
          title,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ],
    );
  }

  int _branchIdFromMap(Map<String, dynamic> b) {
    final raw = b['id'];
    if (raw is int) return raw;
    return int.tryParse(raw?.toString() ?? '') ?? 0;
  }

  Future<void> _fetchBranches() async {
    setState(() {
      _loadingBranches = true;
      _branchesError = null;
    });
    try {
      final list = await ApiService.getBranches();
      setState(() {
        _branches = list;
        _loadingBranches = false;
      });
    } catch (e) {
      setState(() {
        _branchesError = e.toString();
        _branches = [];
        _loadingBranches = false;
      });
    }
  }

  void _selectBranch(int index) {
    if (index < 0 || index >= _branches.length) return;
    setState(() {
      _selectedBranchIndex = index;
    });
  }

  Future<void> _openBranchDirections(double lat, double lng) async {
    final uri = Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng',
    );
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Không mở được Google Maps.')),
      );
    }
  }

  Future<void> _showNearestBranchesPicker(
    List<Map<String, dynamic>> ranked,
  ) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xfff4f5f9),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        final bottom = MediaQuery.paddingOf(ctx).bottom;
        return SingleChildScrollView(
          child: Padding(
            padding: EdgeInsets.fromLTRB(16, 12, 16, 16 + bottom),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Gợi ý chi nhánh gần bạn',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(ctx),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
                const Text(
                  'Khoảng cách là ước tính (đường chim bay). Vui lòng xác nhận địa chỉ trước khi đến.',
                  style: TextStyle(fontSize: 12, color: Colors.black54),
                ),
                const SizedBox(height: 12),
                for (var i = 0; i < ranked.length; i++) ...[
                  _buildNearestSuggestionCard(ctx, ranked[i], i),
                  if (i < ranked.length - 1) const SizedBox(height: 10),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildNearestSuggestionCard(
    BuildContext sheetContext,
    Map<String, dynamic> b,
    int index,
  ) {
    final id = int.tryParse(b['id']?.toString() ?? '') ?? 0;
    final name = b['name']?.toString() ?? 'Chi nhánh';
    final addr = b['address']?.toString().trim() ?? '';
    final phone = b['phone']?.toString().trim() ?? '';
    final dist = b['distance_km'];
    final distLabel = dist is num ? '${dist.toString()} km' : '';
    final lat = (b['latitude'] as num?)?.toDouble();
    final lng = (b['longitude'] as num?)?.toDouble();
    final hoursNote = b['opening_hours_note']?.toString() ?? '';

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              index == 0 ? '$name · Gần nhất' : name,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
            ),
            if (distLabel.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  'Khoảng cách ước tính: $distLabel',
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade700),
                ),
              ),
            if (addr.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(addr, style: const TextStyle(fontSize: 13)),
            ],
            if (phone.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text('Điện thoại: $phone', style: const TextStyle(fontSize: 13)),
            ],
            if (hoursNote.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                hoursNote,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.brown.shade800,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: id <= 0
                        ? null
                        : () {
                            Navigator.pop(sheetContext);
                            final idx = _branches.indexWhere(
                              (branch) => _branchIdFromMap(branch) == id,
                            );
                            if (idx >= 0) {
                              _selectBranch(idx);
                            }
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xffffc107),
                      foregroundColor: Colors.black,
                    ),
                    child: const Text('Chọn chi nhánh này'),
                  ),
                ),
                if (lat != null &&
                    lng != null &&
                    lat.isFinite &&
                    lng.isFinite) ...[
                  const SizedBox(width: 8),
                  IconButton(
                    onPressed: () => _openBranchDirections(lat, lng),
                    tooltip: 'Chỉ đường',
                    icon: const Icon(Icons.directions),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBranchItem(int index, Map<String, dynamic> branch) {
    final isSelected = _selectedBranchIndex == index;
    final name = branch['name']?.toString() ?? 'Chi nhánh';
    final addr = branch['address']?.toString().trim() ?? '';
    final phone = branch['phone']?.toString().trim() ?? '';

    return GestureDetector(
      onTap: () => _selectBranch(index),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? const Color(0xffffc107) : Colors.transparent,
            width: 2,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    name,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: isSelected ? Colors.black : Colors.black87,
                    ),
                  ),
                ),
                if (isSelected)
                  const Icon(Icons.check_circle, color: Color(0xffffc107)),
              ],
            ),
            if (addr.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(addr, style: const TextStyle(fontSize: 13)),
            ],
            if (phone.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text('ĐT: $phone', style: const TextStyle(fontSize: 13)),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _findNearestBranch() async {
    if (_branches.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Chưa có chi nhánh để gợi ý.')),
      );
      return;
    }
    if (kIsWeb) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Trên web, vui lòng chọn chi nhánh trong danh sách.'),
        ),
      );
      return;
    }

    setState(() => _findingNearest = true);
    try {
      final serviceOn = await Geolocator.isLocationServiceEnabled();
      if (!serviceOn) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Vui lòng bật định vị trong Cài đặt thiết bị.'),
          ),
        );
        return;
      }

      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.deniedForever) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Quyền vị trí bị từ chối. Mở Cài đặt ứng dụng để bật lại.',
            ),
          ),
        );
        return;
      }
      if (perm == LocationPermission.denied) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Cần quyền vị trí để tìm chi nhánh gần nhất.'),
          ),
        );
        return;
      }

      Position? pos;
      try {
        pos = await Geolocator.getPositionStream(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
          ),
        ).first.timeout(const Duration(seconds: 10));
      } on TimeoutException {
        rethrow;
      }

      final ranked = await ApiService.getNearestBranches(
        lat: pos.latitude,
        lng: pos.longitude,
        limit: 3,
      );
      if (!mounted) return;
      if (ranked.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Không tính được khoảng cách — chi nhánh có thể chưa có tọa độ GPS trên hệ thống. Hãy chọn chi nhánh trong danh sách.',
            ),
          ),
        );
        return;
      }
      await _showNearestBranchesPicker(ranked);
    } on TimeoutException {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('GPS timeout: Vui lòng thử lại hoặc bật lại định vị.'),
          duration: Duration(seconds: 8),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Lỗi GPS: ${e.runtimeType} — $e')));
    } finally {
      if (mounted) setState(() => _findingNearest = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chi tiết đặt hàng'),
        backgroundColor: const Color(0xffffc107),
      ),
      backgroundColor: const Color(0xfff4f5f9),
      body: ValueListenableBuilder<List<CartEntry>>(
        valueListenable: _events.cartItems,
        builder: (context, cart, _) {
          final total = cart.fold<int>(
            0,
            (sum, item) => sum + item.price * item.quantity,
          );
          if (cart.isEmpty) {
            return const Center(
              child: Text(
                'Giỏ hàng đang trống',
                style: TextStyle(color: Colors.grey),
              ),
            );
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                'Tóm tắt (${cart.length} món)',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 8),
              ...cart.map(
                (e) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${e.name} × ${e.quantity}',
                          style: const TextStyle(fontSize: 14),
                        ),
                      ),
                      Text(
                        _formatMoney(e.price * e.quantity),
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          color: Color(0xffffa000),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const Divider(height: 24),
              Row(
                children: [
                  const Text(
                    'Tổng cộng',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  const Spacer(),
                  Text(
                    _formatMoney(total),
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 18,
                      color: Color(0xffffa000),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              _buildStep('1', 'Chọn chi nhánh nhận hàng'),
              const SizedBox(height: 8),
              if (_loadingBranches)
                const Center(child: CircularProgressIndicator())
              else if (_branchesError != null)
                Text('Không tải được chi nhánh: $_branchesError')
              else if (_branches.isEmpty)
                const Text(
                  'Chưa có chi nhánh nhận hàng. Vui lòng thử lại sau.',
                  style: TextStyle(fontSize: 13, color: Colors.black54),
                )
              else ...[
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: _findingNearest ? null : _findNearestBranch,
                    icon: _findingNearest
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Color(0xFF003366),
                            ),
                          )
                        : const Icon(Icons.near_me_outlined),
                    label: Text(
                      _findingNearest
                          ? 'Đang lấy vị trí…'
                          : 'Chi nhánh gần bạn (GPS)',
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF003366),
                      side: const BorderSide(color: Color(0xFF003366)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                ..._branches.asMap().entries.map(
                  (e) => _buildBranchItem(e.key, e.value),
                ),
              ],
              const SizedBox(height: 20),
              const Text(
                'Thông tin nhận hàng',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _nameCtrl,
                decoration: const InputDecoration(
                  labelText: 'Họ và tên',
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(),
                ),
                textCapitalization: TextCapitalization.words,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Số điện thoại',
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _noteCtrl,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Ghi chú (tuỳ chọn)',
                  hintText: 'Ví dụ: giao buổi chiều, gọi trước khi giao…',
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _addressCtrl,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Địa chỉ người nhận',
                  hintText: 'Nhập địa chỉ giao hàng',
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: Colors.grey.shade300),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: CheckboxListTile(
                  value: _wantInvoice,
                  onChanged: (v) => setState(() => _wantInvoice = v ?? false),
                  title: const Text('Muốn in hóa đơn'),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                ),
              ),
              const SizedBox(height: 28),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _submitting ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xffffc107),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: _submitting
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text(
                          'Đặt hàng',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                        ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
