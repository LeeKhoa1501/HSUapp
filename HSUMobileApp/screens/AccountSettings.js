// screens/AccountSettingsScreen.js
import React, { useState, useEffect } from 'react'; // Đảm bảo useEffect được import
import {View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet, Alert,ActivityIndicator } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { useNavigation } from '@react-navigation/native'; 
import { SafeAreaView } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper'; 

const AccountSettingsScreen = () => {
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);

  const [user, setUser] = useState({ fullName: 'Đang tải...', studentId: '...' });
  const [isLoading, setIsLoading] = useState(true); // Thêm state loading ban đầu
  const navigation = useNavigation(); // Lấy navigation object

  // --- useEffect để load dữ liệu user từ AsyncStorage ---
  useEffect(() => {
    let isMounted = true; // Cờ kiểm tra unmount

    const loadUserData = async () => {
      console.log("ACCOUNT_SCREEN: Loading user data from AsyncStorage...");
      setIsLoading(true); // Bắt đầu loading
      try {
        const userDataString = await AsyncStorage.getItem('userData'); // Key phải khớp lúc lưu
        console.log("ACCOUNT_SCREEN: userDataString from AsyncStorage:", userDataString);
        if (isMounted) { // Chỉ cập nhật nếu component còn mount
            if (userDataString) {
              const userData = JSON.parse(userDataString);
              setUser({
                fullName: userData.fullName || '',
                studentId: userData.studentId || ''
              });
              console.log("ACCOUNT_SCREEN: User data loaded from AsyncStorage:", userData);
            } else {
              console.log("ACCOUNT_SCREEN: No user data found in AsyncStorage.");
              setUser({ fullName: 'Không tìm thấy', studentId: 'N/A' });
              // Có thể Alert hoặc chuyển về Login nếu không có dữ liệu user
              // Alert.alert("Lỗi", "Không tìm thấy thông tin người dùng.");
              // navigation.replace('Login');
            }
        }
      } catch (error) {
        console.error("ACCOUNT_SCREEN: Lỗi load user data from AsyncStorage:", error);
         if (isMounted) {
             setUser({ fullName: 'Lỗi tải', studentId: 'Lỗi' });
             Alert.alert("Lỗi", "Không thể tải thông tin người dùng.");
         }
      } finally {
         if (isMounted) {
            setIsLoading(false); // Kết thúc loading
         }
      }
    };

    loadUserData();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, []); // Chạy 1 lần khi mount

  // --- Hàm xử lý Đăng xuất (Đã sửa lại, đảm bảo AsyncStorage và Navigation đúng) ---
  const handleLogout = () => {
    Alert.alert(
      "Xác nhận đăng xuất",
      "Bạn có chắc chắn muốn đăng xuất khỏi tài khoản?", // Thêm nội dung rõ hơn
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Đăng xuất", // Đổi chữ nút
          onPress: async () => {
            console.log("ACCOUNT_SCREEN: Logging out...");
            try {
              // Xóa các key liên quan đến phiên đăng nhập
              await AsyncStorage.multiRemove(['userToken', 'userData']); // Đảm bảo đúng tên key
              console.log("ACCOUNT_SCREEN: AsyncStorage cleared.");
              // Dùng replace để xóa stack cũ và về màn hình Login
              navigation.replace("Login");
              console.log("ACCOUNT_SCREEN: Navigated to Login.");
            } catch (error) {
              console.error("ACCOUNT_SCREEN: Lỗi khi xóa AsyncStorage:", error);
              Alert.alert("Lỗi", "Không thể đăng xuất. Vui lòng thử lại.");
            }
          },
          style: "destructive", // Màu đỏ
        },
      ],
      { cancelable: true }
    );
  };

  // --- Render UI ---
  // Có thể hiển thị loading ban đầu nếu muốn
   if (isLoading) {
     return (
       <SafeAreaView style={styles.safeArea}>
         <View style={styles.centered}>
           <ActivityIndicator size="large" color="#002366" />
         </View>
       </SafeAreaView>
     );
   }

  return (
    <PaperProvider>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* === Khối Tài khoản === */}
          <Text style={styles.sectionTitle}>Tài khoản</Text>
          <View style={styles.card}>
            {/* --- Dòng thông tin User (Lấy từ state user) --- */}
            <View style={styles.userInfoRow}>
              <FontAwesome name="user-circle-o" size={24} color="#002366" style={styles.iconSpacing}/>
              <View style={styles.userInfoTextContainer}>
                  <Text style={styles.nameText} numberOfLines={1}>{user.fullName}</Text>
                  <Text style={styles.studentIdText}>{user.studentId}</Text>
              </View>
            </View>
            <View style={styles.separator} />

            {/* --- Dòng Sinh trắc học --- */}
            <View style={[styles.menuItemRow, styles.rowBetween]}>
              <View style={styles.menuItemContent}>
                <FontAwesome name="question-circle-o" size={20} color="#555" style={styles.iconSpacing} />
                <Text style={styles.optionText}>Sinh trắc học</Text>
              </View>
              <Switch
                value={biometricsEnabled}
                onValueChange={setBiometricsEnabled}
                trackColor={{ false: "#E9E9EA", true: "#81b0ff" }}
                thumbColor={biometricsEnabled ? "#0056b3" : "#f4f3f4"}
                ios_backgroundColor="#E9E9EA"
              />
            </View>
             <View style={styles.separator} />

            {/* --- Dòng Mã QR --- */}
            <TouchableOpacity style={styles.menuItemRow}>
              <View style={styles.menuItemContent}>
                <FontAwesome name="qrcode" size={20} color="#555" style={styles.iconSpacing} />
                <Text style={styles.optionText}>Mã QR</Text>
              </View>
            </TouchableOpacity>
             <View style={styles.separator} />

            {/* --- Dòng Student Card --- */}
            <TouchableOpacity style={styles.menuItemRow}>
               <View style={styles.menuItemContent}>
                <FontAwesome name="id-card-o" size={20} color="#555" style={styles.iconSpacing} />
                <Text style={styles.optionText}>Student card</Text>
              </View>
            </TouchableOpacity>
             <View style={styles.separator} />

            {/* --- Dòng Đăng xuất (Đã có onPress={handleLogout}) --- */}
            <TouchableOpacity style={styles.menuItemRow} onPress={handleLogout}>
              <View style={styles.menuItemContent}>
                <FontAwesome name="sign-out" size={22} color="#dc3545" style={styles.iconSpacing} />
                <Text style={[styles.optionText, styles.logoutText]}>Đăng xuất</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* === Khối Hỗ trợ === */}
          <Text style={styles.sectionTitle}>Hỗ trợ</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.menuItemRow}>
               <View style={styles.menuItemContent}>
                <FontAwesome name="phone" size={22} color="#555" style={styles.iconSpacing} />
                <Text style={styles.optionText}>Liên hệ</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.separator} />
            <TouchableOpacity style={styles.menuItemRow}>
               <View style={styles.menuItemContent}>
                <FontAwesome name="play-circle-o" size={20} color="#555" style={styles.iconSpacing} />
                <Text style={styles.optionText}>Video</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* === Khối Hoa Sen === */}
          <Text style={styles.sectionTitle}>Hoa Sen</Text>
          <View style={styles.card}>
            <View style={styles.menuItemRow}>
               <View style={styles.menuItemContent}>
                <FontAwesome name="mobile-phone" size={24} color="#555" style={[styles.iconSpacing, { marginLeft: 2 }]}/>
                <Text style={styles.optionText}>Phiên bản 3.2.2</Text>
              </View>
            </View>
          </View>

        </ScrollView>
      </SafeAreaView>
    </PaperProvider>
  );
};

// --- StyleSheet (Thêm centered nếu giữ lại loading) ---
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f0f2f5" }, container: { flex: 1 }, scrollContent: { paddingHorizontal: 16, paddingVertical: 24, paddingBottom: 40 }, sectionTitle: { fontSize: 16, fontWeight: "600", color: "#555", marginBottom: 12, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 }, card: { backgroundColor: "#fff", borderRadius: 12, marginBottom: 24, shadowColor: "#aaa", shadowOpacity: 0.15, shadowOffset: { width: 0, height: 2 }, shadowRadius: 5, elevation: 2 }, userInfoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 20 }, userInfoTextContainer: { flex: 1 }, iconSpacing: { width: 24, textAlign: 'center', marginRight: 18 }, nameText: { fontSize: 17, fontWeight: "bold", color: "#111", marginBottom: 3 }, studentIdText: { fontSize: 14, color: "#ff7f00", fontWeight: '500' }, menuItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15, minHeight: 50 }, menuItemContent: { flexDirection: 'row', alignItems: 'center', flex: 1 }, rowBetween: {}, optionText: { fontSize: 16, color: "#333" }, logoutText: { color: "#dc3545", fontWeight: '500' }, separator: { height: 1, backgroundColor: '#f0f2f5', marginLeft: 16 + 24 + 18 },
  // Thêm style này nếu dùng loading ban đầu
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});

export default AccountSettingsScreen;