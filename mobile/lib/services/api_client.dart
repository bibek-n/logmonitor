import "dart:convert";
import "package:http/http.dart" as http;
import "package:flutter_secure_storage/flutter_secure_storage.dart";

/// Wraps the LogMonitor mobile API (see src/app/api/mobile/* in the main repo). Every
/// endpoint there always answers HTTP 200 with an {ok, error} envelope - IIS on the
/// production server replaces any non-2xx response body with a generic HTML error page, so
/// this app treats a non-200 response as unparseable / a network-layer failure, and relies
/// entirely on `ok` inside the body for real success/failure signaling.
class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => message;
}

class ApiClient {
  static const String baseUrl = "https://logs.tulipshrm.com:4433";
  static const _storage = FlutterSecureStorage();
  static const _tokenKey = "auth_token";
  static const _usernameKey = "auth_username";

  String? _cachedToken;

  Future<String?> get token async {
    _cachedToken ??= await _storage.read(key: _tokenKey);
    return _cachedToken;
  }

  Future<void> saveSession(String token, String username) async {
    _cachedToken = token;
    await _storage.write(key: _tokenKey, value: token);
    await _storage.write(key: _usernameKey, value: username);
  }

  Future<String?> get savedUsername => _storage.read(key: _usernameKey);

  Future<void> logout() async {
    _cachedToken = null;
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _usernameKey);
  }

  Future<bool> get isLoggedIn async => (await token) != null;

  Map<String, String> _jsonHeaders() => {"Content-Type": "application/json"};

  Future<Map<String, String>> _authHeaders() async {
    final t = await token;
    return {"Content-Type": "application/json", if (t != null) "Authorization": "Bearer $t"};
  }

  Future<Map<String, dynamic>> _decode(http.Response res) {
    if (res.statusCode != 200) {
      throw ApiException("Server error (HTTP ${res.statusCode}). Please try again.");
    }
    try {
      return Future.value(jsonDecode(res.body) as Map<String, dynamic>);
    } catch (_) {
      throw ApiException("Unexpected response from server.");
    }
  }

  /// Step 1 of login - checks username/password and emails a one-time code.
  Future<void> requestOtp(String username, String password) async {
    final res = await http.post(
      Uri.parse("$baseUrl/api/auth/request-otp"),
      headers: _jsonHeaders(),
      body: jsonEncode({"username": username, "password": password}),
    );
    final data = await _decode(res);
    if (data["ok"] != true) throw ApiException(data["error"] ?? "Failed to send code.");
  }

  /// Step 2 of login - verifies the code and, on success, returns a bearer token that's
  /// saved for all subsequent requests.
  Future<void> verifyOtp(String username, String password, String otp) async {
    final res = await http.post(
      Uri.parse("$baseUrl/api/mobile/auth/verify"),
      headers: _jsonHeaders(),
      body: jsonEncode({"username": username, "password": password, "otp": otp}),
    );
    final data = await _decode(res);
    if (data["ok"] != true) {
      throw ApiException(_otpErrorMessage(data["error"] as String?));
    }
    await saveSession(data["token"] as String, data["username"] as String);
  }

  String _otpErrorMessage(String? code) {
    switch (code) {
      case "OTP_INVALID":
        return "Incorrect code.";
      case "OTP_EXPIRED":
        return "Code expired - request a new one.";
      case "OTP_LOCKED":
        return "Too many attempts - request a new code.";
      default:
        return code ?? "Failed to verify code.";
    }
  }

  Future<List<NotificationItem>> fetchNotifications() async {
    final res = await http.get(Uri.parse("$baseUrl/api/mobile/notifications"), headers: await _authHeaders());
    final data = await _decode(res);
    if (data["ok"] != true) throw ApiException(data["error"] ?? "Failed to load notifications.");
    return (data["notifications"] as List).map((e) => NotificationItem.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> sendNotification({int? staffId, required String message}) async {
    final res = await http.post(
      Uri.parse("$baseUrl/api/mobile/notifications/send"),
      headers: await _authHeaders(),
      body: jsonEncode({"staffId": staffId, "message": message}),
    );
    final data = await _decode(res);
    if (data["ok"] != true) throw ApiException(data["error"] ?? "Failed to send.");
  }

  Future<List<StaffOption>> fetchStaff() async {
    final res = await http.get(Uri.parse("$baseUrl/api/mobile/staff"), headers: await _authHeaders());
    final data = await _decode(res);
    if (data["ok"] != true) throw ApiException(data["error"] ?? "Failed to load employees.");
    return (data["staff"] as List).map((e) => StaffOption.fromJson(e as Map<String, dynamic>)).toList();
  }
}

class NotificationItem {
  final int id;
  final int? staffId;
  final String? staffName;
  final String message;
  final String sentByUsername;
  final String createdAt;

  NotificationItem({
    required this.id,
    required this.staffId,
    required this.staffName,
    required this.message,
    required this.sentByUsername,
    required this.createdAt,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> json) => NotificationItem(
        id: json["Id"] as int,
        staffId: json["StaffId"] as int?,
        staffName: json["StaffName"] as String?,
        message: json["Message"] as String,
        sentByUsername: json["SentByUsername"] as String,
        createdAt: json["CreatedAt"] as String,
      );
}

class StaffOption {
  final int id;
  final String name;
  StaffOption({required this.id, required this.name});
  factory StaffOption.fromJson(Map<String, dynamic> json) => StaffOption(id: json["Id"] as int, name: json["Name"] as String);
}
