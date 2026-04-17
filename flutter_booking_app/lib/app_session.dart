/// Phiên đăng nhập tối giản: khi vào Home bằng "số đã có trong DB" (bỏ qua Firebase)
/// thì [FirebaseAuth] có thể null — lưu phone/id từ API để màn hình tài khoản đồng bộ DB.
class AppSession {
  AppSession._();

  static String? phone;
  static int? userId;
  static String? fullName;
  static String? avatarUrl;
  static String? role;
  static int profileVersion = 0;

  static void setFromUserMap(Map<String, dynamic> user) {
    final p = user['phone'];
    if (p is String) phone = p;
    final id = user['id'];
    if (id is int) {
      userId = id;
    } else if (id is num) {
      userId = id.toInt();
    }
    final n = user['full_name'];
    if (n is String) fullName = n;
    final a = user['avatar_url'];
    if (a is String) {
      avatarUrl = a;
    } else if (a == null) {
      avatarUrl = null;
    }
    final r = user['role'];
    if (r is String) role = r;
    profileVersion++;
  }

  static void clear() {
    phone = null;
    userId = null;
    fullName = null;
    avatarUrl = null;
    role = null;
    profileVersion = 0;
  }
}
