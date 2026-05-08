import 'dart:io';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_booking_app/app_session.dart';
import 'package:flutter_booking_app/services/api_service.dart';
import 'package:image_picker/image_picker.dart';
import 'login_screen.dart';

// ------------------------------------------------
// Model khớp với bảng users trong DB
// ------------------------------------------------
class UserProfile {
  int id;
  String fullName;
  String phone;
  String? avatarUrl;
  DateTime? dateOfBirth;
  String role;
  String? firebaseUid;

  UserProfile({
    required this.id,
    required this.fullName,
    required this.phone,
    this.avatarUrl,
    this.dateOfBirth,
    this.role = 'customer',
    this.firebaseUid,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    final idRaw = json['id'];
    final id = idRaw is int ? idRaw : (idRaw as num).toInt();
    String? dobRaw = json['date_of_birth']?.toString();
    if (dobRaw != null && dobRaw.length >= 10) {
      dobRaw = dobRaw.substring(0, 10);
    }
    return UserProfile(
      id: id,
      fullName: (json['full_name'] ?? '') as String,
      phone: (json['phone'] ?? '') as String,
      avatarUrl: json['avatar_url'] as String?,
      dateOfBirth: dobRaw != null ? DateTime.tryParse(dobRaw) : null,
      role: (json['role'] ?? 'customer') as String,
      firebaseUid: json['firebase_uid'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'full_name': fullName,
    'phone': phone,
    'avatar_url': avatarUrl,
    'date_of_birth': dateOfBirth != null
        ? '${dateOfBirth!.year}-'
              '${dateOfBirth!.month.toString().padLeft(2, '0')}-'
              '${dateOfBirth!.day.toString().padLeft(2, '0')}'
        : null,
  };
}

String? _displayAvatarUrl(String? stored) {
  return ApiService.resolveMediaUrl(stored);
}

// ------------------------------------------------
// EditProfileScreen
// ------------------------------------------------
class EditProfileScreen extends StatefulWidget {
  final UserProfile profile;

  const EditProfileScreen({super.key, required this.profile});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  static const Color kPrimary = Color(0xffffc107);
  static const Color kIconColor = Color(0xffffa000);
  static const Color kBg = Color(0xfff4f5f9);

  late final TextEditingController _fullNameCtrl;
  late final TextEditingController _phoneCtrl;
  DateTime? _dateOfBirth;
  bool _isSaving = false;

  File? _pickedImageFile;
  final ImagePicker _imagePicker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _fullNameCtrl = TextEditingController(text: widget.profile.fullName);
    _phoneCtrl = TextEditingController(text: widget.profile.phone);
    _dateOfBirth = widget.profile.dateOfBirth;
    WidgetsBinding.instance.addPostFrameCallback((_) => _hydrateFromServer());
  }

  @override
  void dispose() {
    _fullNameCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _hydrateFromServer() async {
    final phone =
        AppSession.phone ?? FirebaseAuth.instance.currentUser?.phoneNumber;
    if (phone == null) return;
    try {
      final map = await ApiService.getUser(phone);
      final p = UserProfile.fromJson(Map<String, dynamic>.from(map));
      if (!mounted) return;
      setState(() {
        widget.profile.id = p.id;
        widget.profile.fullName = p.fullName;
        widget.profile.phone = p.phone;
        widget.profile.dateOfBirth = p.dateOfBirth;
        widget.profile.avatarUrl = p.avatarUrl;
        widget.profile.role = p.role;
        _fullNameCtrl.text = p.fullName;
        _phoneCtrl.text = p.phone;
        _dateOfBirth = p.dateOfBirth;
      });
    } catch (_) {
      // Giữ dữ liệu truyền vào nếu API lỗi
    }
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _dateOfBirth ?? DateTime(1998, 5, 12),
      firstDate: DateTime(1950),
      lastDate: DateTime.now(),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: const ColorScheme.light(
            primary: kPrimary,
            onPrimary: Colors.black,
            onSurface: Colors.black87,
          ),
        ),
        child: child!,
      ),
    );
    if (picked != null) setState(() => _dateOfBirth = picked);
  }

  Future<void> _pickImageFromSource(ImageSource source) async {
    Navigator.pop(context);
    try {
      final XFile? xfile = await _imagePicker.pickImage(
        source: source,
        imageQuality: 85,
        maxWidth: 800,
      );
      if (xfile == null) return;

      setState(() {
        _pickedImageFile = File(xfile.path);
      });

      final uploaded = await ApiService.uploadAvatar(
        userId: widget.profile.id,
        file: File(xfile.path),
      );
      if (!mounted) return;
      setState(() {
        widget.profile.avatarUrl = uploaded['avatar_url'] as String?;
        _pickedImageFile = null;
      });
      // Đồng bộ session ngay để màn trước có thể hiển thị ảnh mới tức thì.
      AppSession.setFromUserMap(uploaded);
      _showSnack('Đã cập nhật ảnh đại diện');
    } catch (e) {
      if (!mounted) return;
      _showSnack('Không thể chọn/tải ảnh: $e', isError: true);
    }
  }

  void _pickAvatar() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Ảnh đại diện',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            _buildSheetItem(
              icon: Icons.camera_alt_outlined,
              label: 'Chụp ảnh mới',
              onTap: () => _pickImageFromSource(ImageSource.camera),
            ),
            Divider(
              height: 1,
              indent: 16,
              endIndent: 16,
              color: Colors.grey.shade100,
            ),
            _buildSheetItem(
              icon: Icons.photo_library_outlined,
              label: 'Chọn từ thư viện',
              onTap: () => _pickImageFromSource(ImageSource.gallery),
            ),
            Divider(
              height: 1,
              indent: 16,
              endIndent: 16,
              color: Colors.grey.shade100,
            ),
            _buildSheetItem(
              icon: Icons.delete_outline,
              label: 'Xóa ảnh đại diện',
              color: Colors.redAccent,
              onTap: () {
                Navigator.pop(context);
                setState(() {
                  _pickedImageFile = null;
                  widget.profile.avatarUrl = null;
                });
              },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Widget _buildSheetItem({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    Color? color,
  }) {
    return ListTile(
      onTap: onTap,
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: color != null
              ? Colors.red.withValues(alpha: 0.1)
              : kPrimary.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: color ?? kIconColor, size: 22),
      ),
      title: Text(
        label,
        style: TextStyle(
          fontWeight: FontWeight.w500,
          color: color ?? Colors.black87,
        ),
      ),
    );
  }

  Future<void> _saveProfile() async {
    if (_fullNameCtrl.text.trim().isEmpty) {
      _showSnack('Vui lòng nhập họ và tên', isError: true);
      return;
    }
    if (_phoneCtrl.text.trim().isEmpty) {
      _showSnack('Vui lòng nhập số điện thoại', isError: true);
      return;
    }

    setState(() => _isSaving = true);

    widget.profile.fullName = _fullNameCtrl.text.trim();
    widget.profile.phone = _phoneCtrl.text.trim();
    widget.profile.dateOfBirth = _dateOfBirth;

    final dobStr = widget.profile.dateOfBirth != null
        ? '${widget.profile.dateOfBirth!.year}-'
              '${widget.profile.dateOfBirth!.month.toString().padLeft(2, '0')}-'
              '${widget.profile.dateOfBirth!.day.toString().padLeft(2, '0')}'
        : null;

    try {
      if (_pickedImageFile != null) {
        final u = await ApiService.uploadAvatar(
          userId: widget.profile.id,
          file: _pickedImageFile!,
        );
        widget.profile.avatarUrl = u['avatar_url'] as String?;
        _pickedImageFile = null;
      }

      final updated = await ApiService.updateUser(
        userId: widget.profile.id,
        fullName: widget.profile.fullName,
        phone: widget.profile.phone,
        avatarUrl: widget.profile.avatarUrl,
        dateOfBirth: dobStr,
      );

      // Luôn lấy lại hồ sơ mới nhất từ server để tránh lệch do format response.
      Map<String, dynamic> latest = Map<String, dynamic>.from(updated);
      try {
        final refreshed = await ApiService.getUser(widget.profile.phone);
        latest = Map<String, dynamic>.from(refreshed);
      } catch (_) {
        // Fallback dùng dữ liệu update nếu API getUser chưa sẵn sàng.
      }

      AppSession.setFromUserMap(latest);
      if (!mounted) return;
      _showSnack('Đã lưu thành công!');
      Navigator.of(context).pop(latest);
    } catch (e) {
      if (!mounted) return;
      _showSnack('Lưu thất bại: $e', isError: true);
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  void _showSnack(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: isError ? Colors.redAccent : kPrimary,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kPrimary,
        elevation: 0,
        centerTitle: true,
        leading: Padding(
          padding: const EdgeInsets.only(left: 8),
          child: IconButton(
            icon: const Icon(Icons.arrow_back, color: Colors.black87),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ),
        title: const Text(
          'Chỉnh sửa hồ sơ',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Colors.black87,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _buildAvatarCard(),
            const SizedBox(height: 16),
            _buildInfoCard(),
            const SizedBox(height: 24),
            _buildSaveButton(),
            const SizedBox(height: 8),
            _buildLogoutButton(),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildAvatarCard() {
    final bool hasLocalImage = _pickedImageFile != null;
    final networkUrl = _displayAvatarUrl(widget.profile.avatarUrl);

    Widget avatarChild;
    if (hasLocalImage) {
      avatarChild = Image.file(_pickedImageFile!, fit: BoxFit.cover);
    } else if (networkUrl != null) {
      avatarChild = Image.network(
        networkUrl,
        fit: BoxFit.cover,
        errorBuilder: (ctx, error, stack) =>
            const Icon(Icons.person, size: 50, color: Colors.grey),
      );
    } else {
      avatarChild = const Icon(Icons.person, size: 50, color: Colors.grey);
    }

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
          Stack(
            children: [
              Container(
                width: 90,
                height: 90,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: kPrimary, width: 3),
                  color: const Color(0xfff5f5f7),
                ),
                child: ClipOval(child: avatarChild),
              ),
              Positioned(
                bottom: 0,
                right: 0,
                child: GestureDetector(
                  onTap: _pickAvatar,
                  child: Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: kPrimary,
                      border: Border.all(color: Colors.white, width: 2),
                    ),
                    child: const Icon(
                      Icons.camera_alt,
                      size: 15,
                      color: Colors.black87,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            _fullNameCtrl.text.isNotEmpty
                ? _fullNameCtrl.text
                : 'Chưa cập nhật',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            _phoneCtrl.text,
            style: const TextStyle(color: Colors.grey, fontSize: 14),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
            decoration: BoxDecoration(
              color: kPrimary.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              widget.profile.role == 'barber' ? 'Thợ cắt tóc' : 'Khách hàng',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: kIconColor,
              ),
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Nhấn vào biểu tượng để thay ảnh',
            style: TextStyle(fontSize: 12, color: Colors.grey),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCard() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 14, 16, 2),
            child: Text(
              'THÔNG TIN TÀI KHOẢN',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: kIconColor,
                letterSpacing: 0.6,
              ),
            ),
          ),
          _buildInputTile(
            icon: Icons.person_outline,
            label: 'Họ và tên',
            controller: _fullNameCtrl,
            keyboardType: TextInputType.name,
            onChanged: (_) => setState(() {}),
          ),
          Divider(
            height: 1,
            indent: 16,
            endIndent: 16,
            color: Colors.grey.shade100,
          ),
          _buildInputTile(
            icon: Icons.phone_outlined,
            label: 'Số điện thoại',
            controller: _phoneCtrl,
            keyboardType: TextInputType.phone,
            onChanged: (_) => setState(() {}),
          ),
          Divider(
            height: 1,
            indent: 16,
            endIndent: 16,
            color: Colors.grey.shade100,
          ),
          _buildDateTile(),
          Divider(
            height: 1,
            indent: 16,
            endIndent: 16,
            color: Colors.grey.shade100,
          ),
          _buildReadonlyTile(
            icon: Icons.badge_outlined,
            label: 'Vai trò',
            value: widget.profile.role == 'barber'
                ? 'Thợ cắt tóc'
                : 'Khách hàng',
          ),
        ],
      ),
    );
  }

  Widget _buildInputTile({
    required IconData icon,
    required String label,
    required TextEditingController controller,
    TextInputType keyboardType = TextInputType.text,
    void Function(String)? onChanged,
  }) {
    return ListTile(
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: kPrimary.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: kIconColor, size: 22),
      ),
      title: Text(
        label,
        style: const TextStyle(fontSize: 11, color: Colors.grey),
      ),
      subtitle: TextField(
        controller: controller,
        keyboardType: keyboardType,
        onChanged: onChanged,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: Colors.black87,
        ),
        cursorColor: kPrimary,
        decoration: const InputDecoration(
          isDense: true,
          contentPadding: EdgeInsets.zero,
          border: InputBorder.none,
          focusedBorder: InputBorder.none,
          enabledBorder: InputBorder.none,
        ),
      ),
    );
  }

  Widget _buildDateTile() {
    final String display = _dateOfBirth != null
        ? '${_dateOfBirth!.day.toString().padLeft(2, '0')}/'
              '${_dateOfBirth!.month.toString().padLeft(2, '0')}/'
              '${_dateOfBirth!.year}'
        : 'Chưa cập nhật';

    return ListTile(
      onTap: _pickDate,
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: kPrimary.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(10),
        ),
        child: const Icon(Icons.cake_outlined, color: kIconColor, size: 22),
      ),
      title: const Text(
        'Ngày sinh',
        style: TextStyle(fontSize: 11, color: Colors.grey),
      ),
      subtitle: Text(
        display,
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: _dateOfBirth != null ? Colors.black87 : Colors.grey.shade400,
        ),
      ),
      trailing: const Icon(Icons.chevron_right, color: Colors.grey),
    );
  }

  Widget _buildReadonlyTile({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return ListTile(
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: kPrimary.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: kIconColor, size: 22),
      ),
      title: Text(
        label,
        style: const TextStyle(fontSize: 11, color: Colors.grey),
      ),
      subtitle: Text(
        value,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: Colors.black87,
        ),
      ),
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: kPrimary.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          value,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            color: kIconColor,
          ),
        ),
      ),
    );
  }

  Widget _buildSaveButton() {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: _isSaving ? null : _saveProfile,
        style: ElevatedButton.styleFrom(
          backgroundColor: kPrimary,
          foregroundColor: Colors.black87,
          disabledBackgroundColor: kPrimary.withValues(alpha: 0.5),
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          elevation: 0,
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
        ),
        child: _isSaving
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  color: Colors.black87,
                  strokeWidth: 2,
                ),
              )
            : const Text('Lưu thay đổi'),
      ),
    );
  }

  Widget _buildLogoutButton() {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: _logout,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFFFFF0F0),
          foregroundColor: Colors.redAccent,
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          elevation: 0,
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
        ),
        child: const Text('Đăng xuất'),
      ),
    );
  }

  Future<void> _logout() async {
    if (_isSaving) return;
    try {
      await FirebaseAuth.instance.signOut();
    } catch (_) {
      // Không chặn luồng logout nếu Firebase trả lỗi.
    }
    AppSession.clear();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }
}
