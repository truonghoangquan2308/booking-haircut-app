// lib/screens/booking_screen.dart
import 'dart:async';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';

import 'date_time_picker_screen.dart';
import '../services/api_service.dart';
import 'promotions_screen.dart';

class BookingScreen extends StatefulWidget {
  const BookingScreen({super.key});

  @override
  State<BookingScreen> createState() => _BookingScreenState();
}

class _BookingScreenState extends State<BookingScreen> {
  int? _selectedBranchIndex;

  /// Chọn nhiều dịch vụ (mỗi dịch vụ tính 1 lần) — chạm thẻ để bật/tắt.
  final Set<int> _selectedServiceIds = <int>{};
  int? _selectedBarberIndex;
  final TextEditingController _noteController = TextEditingController();

  List<Map<String, dynamic>> _branches = [];
  bool _loadingBranches = false;
  String? _branchesError;
  bool _findingNearest = false;

  List<Map<String, dynamic>> _services = [];
  bool _loadingServices = false;
  String? _servicesError;

  List<Map<String, dynamic>> _barbers = [];
  bool _loadingBarbers = false;
  String? _barbersError;
  Map<String, String>? _selectedPromotion;

  bool get _mustPickBranch => _branches.isNotEmpty;

  bool get _branchChosen => !_mustPickBranch || _selectedBranchIndex != null;

  bool get _hasAnyService => _selectedServiceIds.isNotEmpty;

  int _serviceIdOf(Map<String, dynamic> s) {
    final raw = s['id'];
    if (raw is int) return raw;
    return int.tryParse(raw?.toString() ?? '') ?? 0;
  }

  void _toggleServiceSelection(int serviceId) {
    if (serviceId <= 0) return;
    setState(() {
      if (_selectedServiceIds.contains(serviceId)) {
        _selectedServiceIds.remove(serviceId);
      } else {
        _selectedServiceIds.add(serviceId);
      }
    });
  }

  double _cartTotal() {
    var t = 0.0;
    for (final s in _services) {
      final id = _serviceIdOf(s);
      if (id <= 0 || !_selectedServiceIds.contains(id)) continue;
      final p = double.tryParse(s['priceValue']?.toString() ?? '') ?? 0;
      t += p;
    }
    return t;
  }

  /// Dịch vụ đầu tiên trong danh sách đang được chọn — `service_id` lưu DB (một FK).
  int _primaryServiceId() {
    for (final s in _services) {
      final id = _serviceIdOf(s);
      if (id > 0 && _selectedServiceIds.contains(id)) return id;
    }
    return 0;
  }

  String _cartSummaryTitle() {
    final parts = <String>[];
    for (final s in _services) {
      final id = _serviceIdOf(s);
      if (!_selectedServiceIds.contains(id)) continue;
      parts.add(s['name']?.toString() ?? 'Dịch vụ');
    }
    return parts.join(', ');
  }

  String _combinedBookingNote() {
    final buf = StringBuffer('[Dịch vụ đã chọn]\n');
    for (final s in _services) {
      final id = _serviceIdOf(s);
      if (!_selectedServiceIds.contains(id)) continue;
      final name = s['name']?.toString() ?? '';
      final unit = double.tryParse(s['priceValue']?.toString() ?? '') ?? 0;
      buf.write('· $name — ${unit.toStringAsFixed(0)}đ\n');
    }
    final user = _noteController.text.trim();
    if (user.isNotEmpty) {
      buf.write('---\n$user');
    }
    return buf.toString().trim();
  }

  @override
  void initState() {
    super.initState();
    _fetchServices();
    _fetchBranches();
  }

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

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

  /// [preserveSelection]: khi true (kéo làm mới), giữ chi nhánh đang chọn nếu vẫn còn trong API —
  /// tránh “reset” cả form như lần tải đầu.
  Future<void> _fetchBranches({bool preserveSelection = false}) async {
    final int? prevBranchId =
        preserveSelection &&
            _selectedBranchIndex != null &&
            _selectedBranchIndex! < _branches.length
        ? _branchIdFromMap(_branches[_selectedBranchIndex!])
        : null;

    setState(() {
      _loadingBranches = true;
      _branchesError = null;
    });
    try {
      final list = await ApiService.getBranches();
      setState(() {
        _branches = list;
        _loadingBranches = false;

        if (preserveSelection && prevBranchId != null && prevBranchId > 0) {
          final idx = list.indexWhere(
            (b) => _branchIdFromMap(b) == prevBranchId,
          );
          _selectedBranchIndex = idx >= 0 ? idx : null;
          if (idx < 0) {
            _selectedBarberIndex = null;
            _barbers = [];
          }
        } else {
          _selectedBranchIndex = null;
          _selectedBarberIndex = null;
          _barbers = [];
        }
      });
      if (list.isEmpty) {
        await _fetchBarbers();
      } else if (preserveSelection &&
          _selectedBranchIndex != null &&
          _selectedBranchIndex! < list.length) {
        final bid = _branchIdFromMap(list[_selectedBranchIndex!]);
        await _fetchBarbers(branchId: bid > 0 ? bid : null);
      }
    } catch (e) {
      setState(() {
        _branchesError = e.toString();
        _branches = [];
        _loadingBranches = false;
      });
      await _fetchBarbers();
    }
  }

  int _branchIdFromMap(Map<String, dynamic> b) {
    final raw = b['id'];
    if (raw is int) return raw;
    return int.tryParse(raw?.toString() ?? '') ?? 0;
  }

  void _onSelectBranch(int index) {
    final bid = _branchIdFromMap(_branches[index]);
    setState(() {
      _selectedBranchIndex = index;
      _selectedBarberIndex = null;
    });
    _fetchBarbers(branchId: bid > 0 ? bid : null);
  }

  void _selectBranchById(int branchId) {
    if (branchId <= 0) return;
    final idx = _branches.indexWhere((b) => _branchIdFromMap(b) == branchId);
    if (idx < 0) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Chi nhánh này không khớp danh sách đang hiển thị. Kéo tải lại trang.',
            ),
          ),
        );
      }
      return;
    }
    _onSelectBranch(idx);
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
                            _selectBranchById(id);
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

  Future<void> _findNearestBranch() async {
    if (_branches.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Chưa có chi nhánh để gợi ý.')),
      );
      return;
    }
    if (kIsWeb) {
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
              'Không tính được khoảng cách — chi nhánh có thể chưa có tọa độ GPS trên hệ thống. '
              'Hãy chọn tay trong danh sách.',
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
          content: Text(
            'GPS timeout: Vào Settings → About phone → tap Build number 7 lần → Developer options → Select mock location app → chọn app này.',
          ),
          duration: Duration(seconds: 8),
        ),
      );
    } on LocationServiceDisabledException {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('GPS chưa bật. Bật GPS trong Cài đặt thiết bị.'),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Lỗi GPS: ${e.runtimeType} — $e'),
          duration: const Duration(seconds: 8),
        ),
      );
    } finally {
      if (mounted) setState(() => _findingNearest = false);
    }
  }

  Future<void> _fetchServices() async {
    setState(() {
      _loadingServices = true;
      _servicesError = null;
    });

    try {
      final list = await ApiService.getServices();
      final formatted = list
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .map((m) {
            final rawPrice = m['price'];
            final priceNum = double.tryParse(rawPrice?.toString() ?? '');
            final durRaw = m['duration'];
            final dur = durRaw is int
                ? durRaw
                : int.tryParse(durRaw?.toString() ?? '') ?? 30;
            return <String, dynamic>{
              'id': m['id'],
              'name': m['name']?.toString() ?? '',
              'priceValue': (priceNum != null && priceNum.isFinite)
                  ? priceNum
                  : rawPrice,
              'price': _formatPrice(rawPrice),
              'duration': dur > 0 ? dur : 30,
            };
          })
          .toList(growable: false);

      setState(() {
        _services = formatted;
        final keep = formatted.map((e) => _serviceIdOf(e)).toSet();
        _selectedServiceIds.removeWhere((id) => !keep.contains(id));
        _loadingServices = false;
      });
    } catch (e) {
      setState(() {
        _servicesError = e.toString();
        _loadingServices = false;
      });
    }
  }

  Future<void> _fetchBarbers({int? branchId}) async {
    setState(() {
      _loadingBarbers = true;
      _barbersError = null;
    });

    try {
      final barbers = await ApiService.getBarbers(branchId: branchId);
      // Chỉ hiển thị thợ đang làm.
      final available = barbers
          .where((b) {
            final isAvailable = b['is_available'];
            final userIsAvailable = b['user_is_available'];
            final status = b['status'];
            final isAvailBool =
                isAvailable == 1 ||
                isAvailable == '1' ||
                userIsAvailable == 1 ||
                userIsAvailable == '1' ||
                status == 'available' ||
                status == 'Đang Làm';
            return isAvailBool;
          })
          .toList(growable: false);

      setState(() {
        _barbers = available
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList(growable: false);
        _selectedBarberIndex = null;
        _loadingBarbers = false;
      });
    } catch (e) {
      setState(() {
        _barbersError = e.toString();
        _loadingBarbers = false;
      });
    }
  }

  Future<void> _refreshBooking() async {
    await Future.wait([
      _fetchServices(),
      _fetchBranches(preserveSelection: true),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xfff4f5f9),
      appBar: AppBar(
        backgroundColor: const Color(0xffffc107),
        title: const Text(
          'Đặt lịch cắt tóc',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        foregroundColor: Colors.black,
        elevation: 0,
      ),
      body: RefreshIndicator(
        onRefresh: _refreshBooking,
        displacement: 56,
        color: const Color(0xffffc107),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(
            parent: ClampingScrollPhysics(),
          ),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildStep('1', 'Chọn chi nhánh'),
              const SizedBox(height: 12),
              if (!_loadingBranches && _branches.isNotEmpty) ...[
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
                const SizedBox(height: 6),
                Text(
                  'Hoặc chọn chi nhánh trong danh sách bên dưới.',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                ),
                const SizedBox(height: 10),
              ],
              if (_loadingBranches)
                const Center(child: CircularProgressIndicator())
              else if (_branchesError != null)
                Text('Không tải được chi nhánh: $_branchesError')
              else if (_branches.isEmpty)
                const Text(
                  'Chưa có chi nhánh hoạt động — có thể đặt lịch với toàn bộ thợ.',
                  style: TextStyle(fontSize: 13, color: Colors.black54),
                )
              else
                ..._branches.asMap().entries.map(
                  (e) => _buildBranchItem(e.key, e.value),
                ),
              const SizedBox(height: 20),
              IgnorePointer(
                ignoring: !_branchChosen,
                child: Opacity(
                  opacity: _branchChosen ? 1 : 0.45,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (_mustPickBranch && !_branchChosen)
                        const Padding(
                          padding: EdgeInsets.only(bottom: 8),
                          child: Text(
                            'Vui lòng chọn chi nhánh trước.',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF003366),
                            ),
                          ),
                        ),
                      _buildStep('2', 'Chọn dịch vụ'),
                      const SizedBox(height: 6),
                      Text(
                        'Chạm thẻ để chọn / bỏ chọn. Có thể chọn nhiều dịch vụ trong một lần đặt.',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade700,
                          height: 1.35,
                        ),
                      ),
                      const SizedBox(height: 10),
                      if (_loadingServices)
                        const Center(child: CircularProgressIndicator())
                      else if (_servicesError != null)
                        Text('Không tải được dịch vụ: $_servicesError')
                      else if (_services.isEmpty)
                        const Text('Chưa có dịch vụ')
                      else ...[
                        ..._services.map((s) => _buildServiceItem(s)),
                        if (_hasAnyService)
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 12,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(0xfffff8e1),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: const Color(0xffffc107),
                                ),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.receipt_long, size: 22),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      'Tạm tính: ${_formatPrice(_cartTotal())}',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w800,
                                        fontSize: 15,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                      ],
                      const SizedBox(height: 20),
                      _buildStep('3', 'Ghi chú'),
                      const SizedBox(height: 12),
                      _buildNoteInput(),
                      const SizedBox(height: 20),
                      _buildStep('4', 'Chọn thợ'),
                      const SizedBox(height: 12),
                      if (_loadingBarbers)
                        const Center(child: CircularProgressIndicator())
                      else if (_barbersError != null)
                        Text('Không tải được thợ: $_barbersError')
                      else if (_barbers.isEmpty)
                        Text(
                          _mustPickBranch && !_branchChosen
                              ? 'Chọn chi nhánh để xem thợ.'
                              : 'Chưa có thợ đang làm tại chi nhánh này',
                        )
                      else
                        ..._barbers.asMap().entries.map(
                          (e) => _buildBarberItem(e.key, e.value),
                        ),
                      const SizedBox(height: 20),
                      _buildStep('5', 'Sử dụng khuyến mãi'),
                      const SizedBox(height: 12),
                      _buildPromotionPicker(),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed:
                      (_branchChosen &&
                          _hasAnyService &&
                          _selectedBarberIndex != null)
                      ? () {
                          final pid = _primaryServiceId();
                          if (pid <= 0) return;
                          final branchName =
                              _selectedBranchIndex != null &&
                                  _selectedBranchIndex! < _branches.length
                              ? _branches[_selectedBranchIndex!]['name']
                                    ?.toString()
                              : null;
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => DateTimePickerScreen(
                                serviceId: pid,
                                serviceName: _cartSummaryTitle(),
                                servicePriceValue: _cartTotal(),
                                barberId:
                                    int.tryParse(
                                      _barbers[_selectedBarberIndex!]['barber_id']
                                              ?.toString() ??
                                          '',
                                    ) ??
                                    int.tryParse(
                                      _barbers[_selectedBarberIndex!]['id']
                                              ?.toString() ??
                                          '',
                                    ) ??
                                    0,
                                barberName:
                                    (_barbers[_selectedBarberIndex!]['full_name'] ??
                                            _barbers[_selectedBarberIndex!]['name'] ??
                                            _barbers[_selectedBarberIndex!]['phone'] ??
                                            'Thợ')
                                        .toString(),
                                note: _combinedBookingNote(),
                                branchName: branchName,
                              ),
                            ),
                          );
                        }
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xffffc107),
                    disabledBackgroundColor: Colors.grey.shade300,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    'Đặt lịch ngay',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.black,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
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

  Widget _buildBranchItem(int index, Map<String, dynamic> branch) {
    final isSelected = _selectedBranchIndex == index;
    final name = branch['name']?.toString() ?? 'Chi nhánh';
    final addr = branch['address']?.toString().trim() ?? '';
    return GestureDetector(
      onTap: () => _onSelectBranch(index),
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
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: const Color(0xfff5f5f7),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.store_mall_directory_outlined,
                color: Color(0xFF003366),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  if (addr.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      addr,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (isSelected)
              const Icon(Icons.check_circle, color: Color(0xffffc107)),
          ],
        ),
      ),
    );
  }

  Widget _buildServiceItem(Map<String, dynamic> service) {
    final id = _serviceIdOf(service);
    final selected = id > 0 && _selectedServiceIds.contains(id);
    final name = service['name']?.toString() ?? '';
    final unitLabel = service['price']?.toString() ?? '';
    final dur = service['duration'] is int
        ? service['duration'] as int
        : int.tryParse(service['duration']?.toString() ?? '') ?? 30;

    return GestureDetector(
      onTap: id <= 0 ? null : () => _toggleServiceSelection(id),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? const Color(0xffffc107) : Colors.transparent,
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
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: const Color(0xfff5f5f7),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.content_cut, color: Colors.deepPurple),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  Text(
                    '$dur phút',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xffffc107),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                unitLabel,
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
            if (selected) ...[
              const SizedBox(width: 8),
              const Icon(Icons.check_circle, color: Color(0xffffc107)),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildNoteInput() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: TextField(
        controller: _noteController,
        minLines: 2,
        maxLines: 4,
        keyboardType: TextInputType.multiline,
        textInputAction: TextInputAction.newline,
        autocorrect: true,
        enableSuggestions: true,
        decoration: const InputDecoration(
          hintText: 'Nhập ghi chú cho thợ (tuỳ chọn)...',
          border: InputBorder.none,
        ),
      ),
    );
  }

  Widget _buildBarberItem(int index, Map<String, dynamic> barber) {
    final isSelected = _selectedBarberIndex == index;

    final name =
        (barber['full_name'] ?? barber['name'] ?? barber['phone'] ?? 'Thợ')
            .toString();
    final rating =
        (barber['rating'] ??
                barber['rating_avg'] ??
                barber['reviews_rating'] ??
                0)
            .toString();

    return GestureDetector(
      onTap: () => setState(() => _selectedBarberIndex = index),
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
        child: Row(
          children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: const Color(0xffffc107),
              child: Text(
                name.isEmpty ? '?' : name[0],
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  if (barber['bio'] != null &&
                      barber['bio'].toString().isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        barber['bio'].toString(),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Icon(Icons.star, color: Colors.amber, size: 18),
            Text(rating, style: const TextStyle(fontWeight: FontWeight.bold)),
            if (isSelected) ...[
              const SizedBox(width: 8),
              const Icon(Icons.check_circle, color: Color(0xffffc107)),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildPromotionPicker() {
    final selected = _selectedPromotion;
    final hasSelected = selected != null;

    return GestureDetector(
      onTap: () async {
        final result = await Navigator.push<Map<String, String>>(
          context,
          MaterialPageRoute(
            builder: (_) => PromotionsScreen(
              selectable: true,
              selectedTitle: selected?['title'],
            ),
          ),
        );
        if (!mounted || result == null) return;
        setState(() => _selectedPromotion = result);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: hasSelected ? const Color(0xffffc107) : Colors.transparent,
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
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: const Color(0xfff5f5f7),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.card_giftcard, color: Colors.deepPurple),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: hasSelected
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          selected['title'] ?? '',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'HSD: ${selected['expire'] ?? '---'}',
                          style: const TextStyle(
                            color: Colors.red,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    )
                  : const Text(
                      'Chọn ưu đãi / phiếu giảm giá',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
            ),
            if (hasSelected)
              GestureDetector(
                onTap: () => setState(() => _selectedPromotion = null),
                child: const Padding(
                  padding: EdgeInsets.only(right: 8),
                  child: Icon(Icons.close, size: 20, color: Colors.grey),
                ),
              ),
            const Icon(Icons.chevron_right, color: Colors.grey),
          ],
        ),
      ),
    );
  }
}
