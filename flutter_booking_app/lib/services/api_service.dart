// lib/services/api_service.dart
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

class ApiService {
  // Web quản lý chạy trên máy tính: gọi backend qua localhost.
  static const String _webBaseUrl = 'http://localhost:3000';
  // Android emulator: use 10.0.2.2 to reach the host machine.
  // Physical device: override with --dart-define=API_BASE_URL=http://<HOST_IP>:3000
  static const String _mobileBaseUrl = 'http://10.0.2.2:3000';
  static const String _envBaseUrl = String.fromEnvironment('API_BASE_URL');

  /// Dùng khi ghép URL ảnh tĩnh (uploads) nếu backend trả path tương đối.
  static String get baseUrl {
    final env = _envBaseUrl.trim();
    if (env.isNotEmpty) return env;
    return kIsWeb ? _webBaseUrl : _mobileBaseUrl;
  }

  static String get _baseUrl => baseUrl;

  /// Chuẩn hoá URL tài nguyên tĩnh (ảnh/avatar) để chạy được trên máy thật.
  /// - Nếu backend trả URL tuyệt đối chứa localhost/127.0.0.1/10.0.2.2, sẽ đổi host
  ///   sang host của [baseUrl].
  /// - Nếu backend trả đường dẫn tương đối, sẽ ghép với [baseUrl].
  static String? resolveMediaUrl(String? raw) {
    final v = raw?.trim() ?? '';
    if (v.isEmpty || v.toLowerCase() == 'null') return null;

    final apiUri = Uri.tryParse(baseUrl);

    if (v.startsWith('http://') || v.startsWith('https://')) {
      final absolute = Uri.tryParse(v);
      if (absolute == null || apiUri == null) return v;

      final localHosts = {'localhost', '127.0.0.1', '10.0.2.2'};
      if (!localHosts.contains(absolute.host.toLowerCase())) return v;

      return absolute
          .replace(
            scheme: apiUri.scheme,
            host: apiUri.host,
            port: apiUri.hasPort ? apiUri.port : null,
          )
          .toString();
    }

    final normalizedPath = v.startsWith('/') ? v : '/$v';
    return '$baseUrl$normalizedPath';
  }

  static const Duration _httpTimeout = Duration(seconds: 25);

  static Future<http.Response> _get(Uri uri) async {
    try {
      return await http.get(uri).timeout(_httpTimeout);
    } on TimeoutException {
      throw Exception(
        'Timeout gọi API (${uri.path}). Base URL hiện tại: $_baseUrl. '
        'Nếu chạy trên máy thật, dùng --dart-define=API_BASE_URL=http://<IP_MAY_TINH>:3000',
      );
    } on SocketException {
      throw Exception(
        'Không kết nối được backend tại $_baseUrl. '
        'Nếu chạy trên máy thật, dùng --dart-define=API_BASE_URL=http://<IP_MAY_TINH>:3000',
      );
    }
  }

  static Future<http.Response> _post(
    Uri uri, {
    Map<String, String>? headers,
    Object? body,
  }) async {
    try {
      return await http
          .post(uri, headers: headers, body: body)
          .timeout(_httpTimeout);
    } on TimeoutException {
      throw Exception(
        'Timeout gọi API (${uri.path}). Base URL hiện tại: $_baseUrl. '
        'Nếu chạy trên máy thật, dùng --dart-define=API_BASE_URL=http://<IP_MAY_TINH>:3000',
      );
    } on SocketException {
      throw Exception(
        'Không kết nối được backend tại $_baseUrl. '
        'Nếu chạy trên máy thật, dùng --dart-define=API_BASE_URL=http://<IP_MAY_TINH>:3000',
      );
    }
  }

  static Future<http.Response> _put(
    Uri uri, {
    Map<String, String>? headers,
    Object? body,
  }) async {
    try {
      return await http
          .put(uri, headers: headers, body: body)
          .timeout(_httpTimeout);
    } on TimeoutException {
      throw Exception(
        'Timeout gọi API (${uri.path}). Base URL hiện tại: $_baseUrl. '
        'Nếu chạy trên máy thật, dùng --dart-define=API_BASE_URL=http://<IP_MAY_TINH>:3000',
      );
    } on SocketException {
      throw Exception(
        'Không kết nối được backend tại $_baseUrl. '
        'Nếu chạy trên máy thật, dùng --dart-define=API_BASE_URL=http://<IP_MAY_TINH>:3000',
      );
    }
  }

  // ================================================
  // USERS
  // ================================================

  /// Lưu user vào MySQL sau khi Firebase OTP xác minh thành công
  static Future<Map<String, dynamic>> verifyAndSaveUser({
    required String phone,
    required String firebaseUid,
    required String role,
  }) async {
    final response = await _post(
      Uri.parse('$_baseUrl/api/users/verify'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'phone': phone,
        'firebase_uid': firebaseUid,
        'role': role,
      }),
    );
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) {
      return Map<String, dynamic>.from(data as Map);
    }
    throw Exception(data['error'] ?? 'Lỗi không xác định');
  }

  /// Ưu đãi đang hiệu lực (app khách — GET /api/offers)
  static Future<List<Map<String, dynamic>>> getOffers() async {
    final response = await _get(Uri.parse('$_baseUrl/api/offers'));
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) {
      final raw = data['offers'];
      if (raw is List) {
        return raw
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList(growable: false);
      }
      return const [];
    }
    throw Exception(data['error'] ?? 'Lỗi tải ưu đãi');
  }

  /// Lấy thông tin user theo số điện thoại
  static Future<Map<String, dynamic>> getUser(String phone) async {
    final encoded = Uri.encodeComponent(phone);
    final response = await _get(Uri.parse('$_baseUrl/api/users/$encoded'));
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) {
      return Map<String, dynamic>.from(data['user'] as Map);
    }
    throw Exception(data['error'] ?? 'Không tìm thấy user');
  }

  // ================================================
  // SHOP (Sản phẩm)
  // ================================================

  /// Lấy danh sách danh mục sản phẩm
  static Future<List<dynamic>> getProductCategories() async {
    final candidates = <Uri>[
      Uri.parse('$_baseUrl/api/product-categories'),
      Uri.parse('$_baseUrl/api/product_categories'),
      Uri.parse('$_baseUrl/api/categories'),
      Uri.parse('$_baseUrl/api/shop/product-categories'),
      Uri.parse('$_baseUrl/api/shop/product_categories'),
      Uri.parse('$_baseUrl/api/shop/categories'),
      // Một số biến thể route hay gặp
      Uri.parse('$_baseUrl/api/shop/product-category'),
      Uri.parse('$_baseUrl/api/shop/product_category'),
      Uri.parse('$_baseUrl/api/shop/productCategories'),
      Uri.parse('$_baseUrl/api/shop/product_categories/list'),
      Uri.parse('$_baseUrl/api/shop/product-categories/list'),
      Uri.parse('$_baseUrl/api/shop/category'),
      Uri.parse('$_baseUrl/api/shop/category/list'),
      Uri.parse('$_baseUrl/api/product-categories/list'),
      Uri.parse('$_baseUrl/api/product_categories/list'),
    ];

    final attempts = <String>[];
    for (final uri in candidates) {
      try {
        final response = await _get(uri);
        final trimmed = response.body.trim();
        final normalized = trimmed.replaceAll('\uFEFF', '');

        late final dynamic decoded;
        try {
          decoded = jsonDecode(normalized);
        } on FormatException {
          final preview = normalized.length > 200
              ? '${normalized.substring(0, 200)}...'
              : normalized;
          attempts.add('GET ${uri.path} => not-json. Response: $preview');
          continue;
        }

        if (decoded is List) return decoded;

        if (decoded is Map<String, dynamic>) {
          final list =
              decoded['categories'] ??
              decoded['product_categories'] ??
              decoded['productCategories'] ??
              decoded['data'] ??
              decoded['rows'] ??
              decoded['items'];
          if (list is List) return list;

          attempts.add(
            'GET ${uri.path} => json unexpected format. Error: ${decoded['error'] ?? decoded['message']}',
          );
          continue;
        }

        attempts.add('GET ${uri.path} => json unexpected type.');
      } catch (e) {
        attempts.add('GET ${uri.path} => exception: $e');
      }
    }

    throw Exception(
      'Lỗi tải danh mục sản phẩm. Attempts: ${attempts.join(' | ')}',
    );
  }

  /// Lấy danh sách sản phẩm
  static Future<List<dynamic>> getProducts() async {
    final candidates = <Uri>[
      Uri.parse('$_baseUrl/api/products'),
      Uri.parse('$_baseUrl/api/shop/products'),
      Uri.parse('$_baseUrl/api/shop/product'),
      Uri.parse('$_baseUrl/api/shop/products/list'),
      Uri.parse('$_baseUrl/api/products/list'),
      Uri.parse('$_baseUrl/api/shop/items'),
      Uri.parse('$_baseUrl/api/shop/products/all'),
      Uri.parse('$_baseUrl/api/shop/shop-products'),
      Uri.parse('$_baseUrl/api/shop/product-items'),
      Uri.parse('$_baseUrl/api/shop/products/all'),
      Uri.parse('$_baseUrl/api/shop/shop_product'),
    ];

    final attempts = <String>[];
    for (final uri in candidates) {
      try {
        final response = await _get(uri);
        final trimmed = response.body.trim();
        final normalized = trimmed.replaceAll('\uFEFF', '');

        late final dynamic decoded;
        try {
          decoded = jsonDecode(normalized);
        } on FormatException {
          final preview = normalized.length > 200
              ? '${normalized.substring(0, 200)}...'
              : normalized;
          attempts.add('GET ${uri.path} => not-json. Response: $preview');
          continue;
        }

        if (decoded is List) return decoded;

        if (decoded is Map<String, dynamic>) {
          final list =
              decoded['products'] ??
              decoded['shop_products'] ??
              decoded['product'] ??
              decoded['data'] ??
              decoded['rows'] ??
              decoded['items'];
          if (list is List) return list;

          attempts.add(
            'GET ${uri.path} => json unexpected format. Error: ${decoded['error'] ?? decoded['message']}',
          );
          continue;
        }

        attempts.add('GET ${uri.path} => json unexpected type.');
      } catch (e) {
        attempts.add('GET ${uri.path} => exception: $e');
      }
    }

    throw Exception('Lỗi tải sản phẩm. Attempts: ${attempts.join(' | ')}');
  }

  /// Cập nhật thông tin user
  static Future<Map<String, dynamic>> updateUser({
    required int userId,
    String? fullName,
    String? phone,
    String? avatarUrl,
    String? dateOfBirth,
  }) async {
    final response = await _put(
      Uri.parse('$_baseUrl/api/users/$userId'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'full_name': fullName,
        'phone': phone,
        'avatar_url': avatarUrl,
        'date_of_birth': dateOfBirth,
      }),
    );
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) {
      return Map<String, dynamic>.from(data['user'] as Map);
    }
    throw Exception(data['error'] ?? 'Lỗi cập nhật');
  }

  static MediaType _mimeMediaTypeForPath(String path) {
    final p = path.toLowerCase();
    if (p.endsWith('.png')) return MediaType('image', 'png');
    if (p.endsWith('.gif')) return MediaType('image', 'gif');
    if (p.endsWith('.webp')) return MediaType('image', 'webp');
    if (p.endsWith('.jpg') || p.endsWith('.jpeg')) {
      return MediaType('image', 'jpeg');
    }
    return MediaType('image', 'jpeg');
  }

  /// Upload ảnh đại diện (multipart), cập nhật `avatar_url` trên server.
  static Future<Map<String, dynamic>> uploadAvatar({
    required int userId,
    required File file,
  }) async {
    final uri = Uri.parse('$_baseUrl/api/users/$userId/avatar');
    final request = http.MultipartRequest('POST', uri);
    request.files.add(
      await http.MultipartFile.fromPath(
        'avatar',
        file.path,
        filename: file.path.split(Platform.pathSeparator).last,
        contentType: _mimeMediaTypeForPath(file.path),
      ),
    );
    final streamed = await request.send().timeout(_httpTimeout);
    final response = await http.Response.fromStream(streamed);
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode == 200) return data['user'] as Map<String, dynamic>;
    throw Exception(data['error'] ?? 'Lỗi tải ảnh lên');
  }

  /// Cập nhật trạng thái thợ (barber) theo `users` table.
  /// status: 'available' | 'off'
  static Future<Map<String, dynamic>> updateBarberStatus({
    required int userId,
    required String status,
  }) async {
    final response = await _put(
      Uri.parse('$_baseUrl/api/users/$userId/status'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'status': status}),
    );
    final body = response.body.trim();
    final contentType = response.headers['content-type'] ?? '';

    final looksLikeJson =
        body.startsWith('{') || body.startsWith('[') || body.isEmpty;
    if (!contentType.toLowerCase().contains('application/json') &&
        !looksLikeJson) {
      final preview = body.length > 200 ? '${body.substring(0, 200)}...' : body;
      throw Exception(
        'API cập nhật trạng thái trả không phải JSON (status ${response.statusCode}). Response: $preview',
      );
    }

    late final dynamic decoded;
    try {
      decoded = body.isEmpty ? {} : jsonDecode(body);
    } on FormatException {
      final preview = body.length > 200 ? '${body.substring(0, 200)}...' : body;
      throw Exception(
        'API cập nhật trạng thái JSON lỗi (status ${response.statusCode}). Response: $preview',
      );
    }

    if (response.statusCode == 200 || response.statusCode == 201) {
      if (decoded is Map<String, dynamic>) {
        final raw = decoded['user'] ?? decoded['data'] ?? decoded;
        if (raw is Map<String, dynamic>) return raw;
      }
    }

    if (decoded is Map<String, dynamic>) {
      throw Exception(
        decoded['error'] ?? decoded['message'] ?? 'Lỗi cập nhật trạng thái',
      );
    }

    throw Exception('Lỗi cập nhật trạng thái');
  }

  // ================================================
  // SERVICES (Dịch vụ)
  // ================================================

  /// Lấy danh sách dịch vụ
  static Future<List<dynamic>> getServices() async {
    final response = await _get(Uri.parse('$_baseUrl/api/services'));
    final body = response.body;
    final contentType = response.headers['content-type'] ?? '';

    final trimmed = body.trim();
    final looksLikeJson =
        trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.isEmpty;
    if (!contentType.toLowerCase().contains('application/json') &&
        !looksLikeJson) {
      final preview = trimmed.length > 200
          ? '${trimmed.substring(0, 200)}...'
          : trimmed;
      throw Exception(
        'API không trả JSON tại /api/services (status ${response.statusCode}). Response: $preview',
      );
    }

    late final dynamic decoded;
    try {
      decoded = jsonDecode(body);
    } on FormatException catch (_) {
      final preview = trimmed.length > 200
          ? '${trimmed.substring(0, 200)}...'
          : trimmed;
      throw Exception(
        'API JSON bị lỗi tại /api/services (status ${response.statusCode}). Response: $preview',
      );
    }

    // Backend của bạn đôi khi trả:
    // - { "status": "success", "services": [...] }
    // - { "status": "success", "data": [...] }
    // - hoặc trực tiếp trả list
    if (response.statusCode == 200 || response.statusCode == 201) {
      if (decoded is Map<String, dynamic>) {
        final list = decoded['services'] ?? decoded['data'];
        if (list is List) return list;
      }
      if (decoded is List) return decoded;
    }

    final message = decoded is Map<String, dynamic> ? decoded['error'] : null;
    throw Exception(message ?? 'Lỗi tải dịch vụ');
  }

  // ================================================
  // BRANCHES (Chi nhánh)
  // ================================================

  /// Chi nhánh đang hoạt động (đặt lịch).
  static Future<List<Map<String, dynamic>>> getBranches() async {
    final response = await _get(Uri.parse('$_baseUrl/api/branches'));
    final body = response.body;
    if (response.statusCode == 404) {
      throw Exception(
        '404 /api/branches — backend chưa có route hoặc sai URL. '
        'Khởi động lại Node (flutter_booking_app/backend) và kiểm tra port trùng với app.',
      );
    }
    late final dynamic decoded;
    try {
      decoded = jsonDecode(body);
    } on FormatException catch (_) {
      throw Exception(
        'Phản hồi không phải JSON tại /api/branches (HTTP ${response.statusCode}).',
      );
    }
    if (response.statusCode == 200 && decoded is Map<String, dynamic>) {
      final list = decoded['branches'] ?? decoded['data'];
      if (list is List) {
        return list
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList(growable: false);
      }
    }
    final message = decoded is Map<String, dynamic>
        ? decoded['error']?.toString()
        : null;
    throw Exception(message ?? 'Lỗi tải chi nhánh (${response.statusCode})');
  }

  /// Top [limit] chi nhánh gần [lat],[lng] (km — đường chim bay). Cần DB có `latitude`/`longitude`.
  static Future<List<Map<String, dynamic>>> getNearestBranches({
    required double lat,
    required double lng,
    int limit = 3,
  }) async {
    final uri = Uri.parse('$_baseUrl/api/branches/nearest').replace(
      queryParameters: <String, String>{
        'lat': lat.toString(),
        'lng': lng.toString(),
        'limit': limit.toString(),
      },
    );
    final response = await _get(uri);
    final body = response.body;
    late final dynamic decoded;
    try {
      decoded = jsonDecode(body);
    } on FormatException catch (_) {
      throw Exception(
        'Phản hồi không phải JSON tại /api/branches/nearest (HTTP ${response.statusCode}).',
      );
    }
    if (response.statusCode == 200 && decoded is Map<String, dynamic>) {
      final list = decoded['branches'];
      if (list is List) {
        return list
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList(growable: false);
      }
    }
    final message = decoded is Map<String, dynamic>
        ? decoded['error']?.toString()
        : null;
    throw Exception(
      message ?? 'Lỗi tìm chi nhánh gần (${response.statusCode})',
    );
  }

  /// Đặt hàng shop (ghi `shop_orders` — manager-web hiển thị tại Đơn shop).
  static Future<Map<String, dynamic>> shopCheckout({
    required String fullName,
    required String phone,
    required String note,
    required String address,
    required bool wantInvoice,
    required List<Map<String, dynamic>> items,
    required int branchId,
    String? firebaseUid,
  }) async {
    final payload = <String, dynamic>{
      'full_name': fullName,
      'phone': phone,
      'note': note,
      'address': address,
      'want_invoice': wantInvoice,
      'items': items,
      'branch_id': branchId,
    };
    if (firebaseUid != null && firebaseUid.isNotEmpty) {
      payload['firebase_uid'] = firebaseUid;
    }
    final response = await _post(
      Uri.parse('$_baseUrl/api/shop/checkout'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(payload),
    );
    final decoded = jsonDecode(response.body);
    if (response.statusCode == 201 && decoded is Map<String, dynamic>) {
      return decoded;
    }
    final msg = decoded is Map<String, dynamic>
        ? decoded['error']?.toString()
        : null;
    throw Exception(msg ?? 'Đặt hàng thất bại (${response.statusCode})');
  }

  /// Lấy lịch sử đơn hàng shop cho khách hàng.
  static Future<List<Map<String, dynamic>>> getShopOrders({
    required int customerId,
    String? status,
    int limit = 50,
    int offset = 0,
  }) async {
    final query = <String>[];
    query.add('customer_id=$customerId');
    if (status != null && status.isNotEmpty) {
      query.add('status=${Uri.encodeQueryComponent(status)}');
    }
    query.add('limit=$limit');
    query.add('offset=$offset');
    final uri = Uri.parse('$_baseUrl/api/shop/orders?${query.join('&')}');
    final response = await _get(uri);
    final decoded = jsonDecode(response.body);
    if (response.statusCode == 200 && decoded is Map<String, dynamic>) {
      final orders = decoded['orders'];
      if (orders is List) {
        return orders
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList(growable: false);
      }
    }
    final message = decoded is Map<String, dynamic>
        ? decoded['error']?.toString()
        : null;
    throw Exception(message ?? 'Lỗi tải đơn hàng (${response.statusCode})');
  }

  static Future<Map<String, dynamic>> getShopOrderDetail({
    required int orderId,
    int? customerId,
  }) async {
    final query = <String>[];
    if (customerId != null && customerId > 0) {
      query.add('customer_id=$customerId');
    }
    final uri = Uri.parse(
      '$_baseUrl/api/shop/orders/$orderId${query.isEmpty ? '' : '?${query.join('&')}'}',
    );
    final response = await _get(uri);
    final decoded = jsonDecode(response.body);
    if (response.statusCode == 200 && decoded is Map<String, dynamic>) {
      final order = decoded['order'];
      final items = decoded['items'];
      if (order is Map && items is List) {
        return {
          'order': Map<String, dynamic>.from(order),
          'items': items
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList(growable: false),
        };
      }
    }
    final message = decoded is Map<String, dynamic>
        ? decoded['error']?.toString()
        : null;
    throw Exception(
      message ?? 'Lỗi tải chi tiết đơn hàng (${response.statusCode})',
    );
  }

  // ================================================
  // BARBERS (Thợ cắt tóc)
  // ================================================

  /// [branchId] nếu có — chỉ thợ thuộc chi nhánh đó (backend có cột `branch_id`).
  static Future<List<dynamic>> getBarbers({int? branchId}) async {
    final path = (branchId != null && branchId > 0)
        ? '$_baseUrl/api/barbers?branch_id=$branchId'
        : '$_baseUrl/api/barbers';
    final response = await _get(Uri.parse(path));
    final body = response.body;
    final contentType = response.headers['content-type'] ?? '';

    final trimmed = body.trim();
    final looksLikeJson =
        trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.isEmpty;
    if (!contentType.toLowerCase().contains('application/json') &&
        !looksLikeJson) {
      final preview = trimmed.length > 200
          ? '${trimmed.substring(0, 200)}...'
          : trimmed;
      throw Exception(
        'API không trả JSON tại /api/barbers (status ${response.statusCode}). Response: $preview',
      );
    }

    late final dynamic decoded;
    try {
      decoded = jsonDecode(body);
    } on FormatException catch (_) {
      final preview = trimmed.length > 200
          ? '${trimmed.substring(0, 200)}...'
          : trimmed;
      throw Exception(
        'API JSON bị lỗi tại /api/barbers (status ${response.statusCode}). Response: $preview',
      );
    }

    // Backend của bạn đôi khi trả:
    // - { "status": "success", "barbers": [...] }
    // - { "status": "success", "data": [...] }
    // - hoặc trực tiếp trả list
    if (response.statusCode == 200 || response.statusCode == 201) {
      if (decoded is Map<String, dynamic>) {
        final list = decoded['barbers'] ?? decoded['data'];
        if (list is List) return list;
      }
      if (decoded is List) return decoded;
    }

    final message = decoded is Map<String, dynamic> ? decoded['error'] : null;
    throw Exception(message ?? 'Lỗi tải barber');
  }

  /// Một thợ theo [userId] — nhẹ, dùng màn Lịch làm việc / Home thợ (không gọi GET /api/barbers toàn bộ).
  static Future<Map<String, dynamic>> getBarberByUserId(int userId) async {
    final response = await _get(
      Uri.parse('$_baseUrl/api/barbers/by-user/$userId'),
    );
    final body = response.body;
    late final dynamic decoded;
    try {
      decoded = jsonDecode(body);
    } on FormatException catch (_) {
      throw Exception('API JSON lỗi tại /api/barbers/by-user ($userId)');
    }
    if (response.statusCode == 200 && decoded is Map<String, dynamic>) {
      final raw = decoded['barber'];
      if (raw is Map) return Map<String, dynamic>.from(raw);
    }
    final message = decoded is Map<String, dynamic>
        ? decoded['error']?.toString()
        : null;
    throw Exception(message ?? 'Không tìm thấy thợ (user_id=$userId)');
  }

  /// Lấy chi tiết barber
  static Future<Map<String, dynamic>> getBarber(int barberId) async {
    final response = await _get(Uri.parse('$_baseUrl/api/barbers/$barberId'));
    final body = response.body;
    final trimmed = body.trim();

    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      final preview = trimmed.length > 200
          ? '${trimmed.substring(0, 200)}...'
          : trimmed;
      throw Exception(
        'API không trả JSON tại /api/barbers/$barberId (status ${response.statusCode}). Response: $preview',
      );
    }

    late final dynamic decoded;
    try {
      decoded = jsonDecode(body);
    } on FormatException catch (_) {
      final preview = trimmed.length > 200
          ? '${trimmed.substring(0, 200)}...'
          : trimmed;
      throw Exception(
        'API JSON bị lỗi tại /api/barbers/$barberId (status ${response.statusCode}). Response: $preview',
      );
    }

    if (response.statusCode == 200 || response.statusCode == 201) {
      if (decoded is Map<String, dynamic>) {
        final raw = decoded['barber'] ?? decoded['data'];
        if (raw is Map<String, dynamic>) return raw;
      }
    }
    final message = decoded is Map<String, dynamic> ? decoded['error'] : null;
    throw Exception(message ?? 'Không tìm thấy barber');
  }

  // ================================================
  // TIME SLOTS (Khung giờ)
  // ================================================

  /// Lấy khung giờ trống của barber theo ngày
  /// [date] định dạng 'yyyy-MM-dd' VD: '2026-03-15'
  static Future<List<dynamic>> getTimeSlots({
    required int barberId,
    required String date,
  }) async {
    final response = await _get(
      Uri.parse('$_baseUrl/api/timeslots/$barberId/$date'),
    );
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) return data['slots'];
    throw Exception(data['error'] ?? 'Lỗi tải khung giờ');
  }

  // ================================================
  // APPOINTMENTS (Lịch hẹn)
  // ================================================

  /// Đặt lịch hẹn
  static Future<Map<String, dynamic>> createAppointment({
    required int customerId,
    required int barberId,
    required int serviceId,
    required int timeSlotId,
    required String apptDate,
    required String startTime,
    required String endTime,
    required double totalPrice,
    String? note,
  }) async {
    final response = await _post(
      Uri.parse('$_baseUrl/api/appointments'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'customer_id': customerId,
        'barber_id': barberId,
        'service_id': serviceId,
        'time_slot_id': timeSlotId,
        'appt_date': apptDate,
        'start_time': startTime,
        'end_time': endTime,
        'total_price': totalPrice,
        'note': note,
      }),
    );
    final data = jsonDecode(response.body);
    if (response.statusCode == 201) return data;
    throw Exception(data['error'] ?? 'Lỗi đặt lịch');
  }

  /// Lấy lịch hẹn của khách hàng
  static Future<List<dynamic>> getCustomerAppointments(int customerId) async {
    final response = await _get(
      Uri.parse('$_baseUrl/api/appointments/customer/$customerId'),
    );
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) return data['appointments'];
    throw Exception(data['error'] ?? 'Lỗi tải lịch hẹn');
  }

  /// Lấy lịch làm việc của barber
  static Future<List<dynamic>> getBarberAppointments(int barberId) async {
    final response = await _get(
      Uri.parse('$_baseUrl/api/appointments/barber/$barberId'),
    );
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) return data['appointments'];
    throw Exception(data['error'] ?? 'Lỗi tải lịch làm');
  }

  /// Cập nhật trạng thái lịch hẹn
  /// [status]: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
  static Future<void> updateAppointmentStatus({
    required int appointmentId,
    required String status,
  }) async {
    final response = await _put(
      Uri.parse('$_baseUrl/api/appointments/$appointmentId/status'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'status': status}),
    );
    if (response.statusCode != 200) {
      final data = jsonDecode(response.body);
      throw Exception(data['error'] ?? 'Lỗi cập nhật trạng thái');
    }
  }

  // ================================================
  // REVIEWS (Đánh giá)
  // ================================================

  /// Gửi đánh giá sau khi hoàn thành dịch vụ
  static Future<void> createReview({
    required int appointmentId,
    required int customerId,
    required int barberId,
    required int rating,
    String? comment,
  }) async {
    final response = await _post(
      Uri.parse('$_baseUrl/api/reviews'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'appointment_id': appointmentId,
        'customer_id': customerId,
        'barber_id': barberId,
        'rating': rating,
        'comment': comment,
      }),
    );
    if (response.statusCode != 201) {
      final data = jsonDecode(response.body);
      throw Exception(data['error'] ?? 'Lỗi gửi đánh giá');
    }
  }

  /// Lấy danh sách đánh giá.
  /// Dùng cho các màn cần tự tính rating trung bình khi backend chưa cập nhật ngay.
  static Future<List<Map<String, dynamic>>> getReviews() async {
    final candidates = <Uri>[
      Uri.parse('$_baseUrl/api/reviews'),
      Uri.parse('$_baseUrl/api/admin/reviews'),
    ];

    for (final uri in candidates) {
      try {
        final response = await _get(uri);
        final body = response.body.trim();
        final contentType = response.headers['content-type'] ?? '';
        final looksLikeJson =
            body.startsWith('{') || body.startsWith('[') || body.isEmpty;
        if (!contentType.toLowerCase().contains('application/json') &&
            !looksLikeJson) {
          continue;
        }

        final decoded = body.isEmpty ? [] : jsonDecode(body);
        if (response.statusCode == 200 || response.statusCode == 201) {
          if (decoded is List) {
            return decoded
                .whereType<Map>()
                .map((e) => Map<String, dynamic>.from(e))
                .toList(growable: false);
          }
          if (decoded is Map<String, dynamic>) {
            final list =
                decoded['reviews'] ?? decoded['data'] ?? decoded['rows'];
            if (list is List) {
              return list
                  .whereType<Map>()
                  .map((e) => Map<String, dynamic>.from(e))
                  .toList(growable: false);
            }
          }
          return const <Map<String, dynamic>>[];
        }
      } catch (_) {
        // thử endpoint kế tiếp
      }
    }

    // Một số backend chưa mở endpoint đọc reviews.
    // Không ném lỗi để UI barber hiển thị trạng thái "chưa có đánh giá".
    return const <Map<String, dynamic>>[];
  }

  /// Lấy đánh giá theo barber.
  /// Ưu tiên endpoint chuyên biệt cho barber nếu backend có hỗ trợ.
  static Future<List<Map<String, dynamic>>> getReviewsByBarber(
    int barberId,
  ) async {
    if (barberId <= 0) return const <Map<String, dynamic>>[];
    final candidates = <Uri>[
      Uri.parse('$_baseUrl/api/reviews/barber/$barberId'),
      Uri.parse('$_baseUrl/api/barbers/$barberId/reviews'),
    ];

    for (final uri in candidates) {
      try {
        final response = await _get(uri);
        final body = response.body.trim();
        final contentType = response.headers['content-type'] ?? '';
        final looksLikeJson =
            body.startsWith('{') || body.startsWith('[') || body.isEmpty;
        if (!contentType.toLowerCase().contains('application/json') &&
            !looksLikeJson) {
          continue;
        }

        final decoded = body.isEmpty ? [] : jsonDecode(body);
        if (response.statusCode == 200 || response.statusCode == 201) {
          if (decoded is List) {
            return decoded
                .whereType<Map>()
                .map((e) => Map<String, dynamic>.from(e))
                .toList(growable: false);
          }
          if (decoded is Map<String, dynamic>) {
            final list =
                decoded['reviews'] ?? decoded['data'] ?? decoded['rows'];
            if (list is List) {
              return list
                  .whereType<Map>()
                  .map((e) => Map<String, dynamic>.from(e))
                  .toList(growable: false);
            }
          }
        }
      } catch (_) {
        // thử endpoint kế tiếp
      }
    }
    return const <Map<String, dynamic>>[];
  }

  // ================================================
  // NOTIFICATIONS (Thông báo)
  // ================================================

  /// Lấy thông báo của user
  static Future<List<dynamic>> getNotifications(int userId) async {
    final response = await _get(
      Uri.parse('$_baseUrl/api/notifications/$userId'),
    );
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) return data['notifications'];
    throw Exception(data['error'] ?? 'Lỗi tải thông báo');
  }

  /// Đánh dấu thông báo đã đọc
  static Future<void> markNotificationRead(int notificationId) async {
    await _put(Uri.parse('$_baseUrl/api/notifications/$notificationId/read'));
  }
}
