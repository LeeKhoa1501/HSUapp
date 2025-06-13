// HSUMobileApp/screens/AccountSettingsScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, Alert, ActivityIndicator, Image, Linking,Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons'; // Thêm MaterialIcons nếu cần
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

// --- Constants ---
const DEFAULT_AVATAR = require('../assets/images/user.png'); // Khoa tạo 1 ảnh avatar mặc định

// --- Main Component: AccountSettingsScreen ---
const AccountSettingsScreen = () => {
    const navigation = useNavigation();
    const isMountedRef = useRef(true);

    // --- State ---
    const [user, setUser] = useState({ fullName: 'Đang tải...', studentId: '...', avatarUrl: null });
    const [isLoading, setIsLoading] = useState(true);

    // --- Lifecycle: Component Mount/Unmount ---
    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // --- Load User Data ---
    const loadUserData = useCallback(async () => {
        if (!isMountedRef.current) return;
        console.log("[AccountSettings] Loading user data...");
        setIsLoading(true);
        try {
            // Giả sử thông tin user (bao gồm avatarUrl) được lưu trong 'userData' khi đăng nhập
            // Hoặc Khoa có thể gọi API /api/auth/me ở đây nếu muốn dữ liệu mới nhất
            const userDataString = await AsyncStorage.getItem('userData');
            if (isMountedRef.current) {
                if (userDataString) {
                    const loadedUser = JSON.parse(userDataString);
                    setUser({
                        fullName: loadedUser.fullName || 'Chưa cập nhật',
                        studentId: loadedUser.studentId || 'N/A',
                        avatarUrl: loadedUser.avatarUrl || null, // Lấy avatarUrl
                    });
                    console.log("[AccountSettings] User data loaded:", loadedUser);
                } else {
                    console.warn("[AccountSettings] No user data found in AsyncStorage.");
                    Alert.alert("Lỗi", "Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.", [
                        { text: "OK", onPress: () => navigation.replace('Login') }
                    ]);
                }
            }
        } catch (error) {
            console.error("[AccountSettings] Error loading user data:", error);
            if (isMountedRef.current) {
                Alert.alert("Lỗi", "Không thể tải thông tin người dùng.");
            }
        } finally {
            if (isMountedRef.current) setIsLoading(false);
        }
    }, [navigation]);

    useEffect(() => {
        loadUserData();
    }, [loadUserData]);

    // --- Event Handlers ---
    const handleLogout = useCallback(() => {
        Alert.alert(
            "Xác nhận Đăng xuất",
            "Bạn có chắc chắn muốn đăng xuất khỏi tài khoản?",
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Đăng xuất",
                    onPress: async () => {
                        console.log("[AccountSettings] Logging out...");
                        try {
                            await AsyncStorage.multiRemove(['userToken', 'userData', 'favoriteFunctionIds']); // Xóa các key liên quan
                            if (isMountedRef.current) navigation.replace("Login");
                        } catch (error) {
                            console.error("[AccountSettings] Logout error:", error);
                            Alert.alert("Lỗi", "Không thể đăng xuất. Vui lòng thử lại.");
                        }
                    },
                    style: "destructive",
                },
            ],
            { cancelable: true }
        );
    }, [navigation]);

    const handleNavigateTo = (screenName) => {
        if (screenName) {
            navigation.navigate(screenName);
        } else {
            Alert.alert("Thông báo", "Chức năng này đang được phát triển.");
        }
    };

    // --- Render Helper: Menu Item ---
    const MenuItem = ({ icon, iconFamily = 'FontAwesome5', text, onPress, isDestructive = false }) => (
        <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
            {iconFamily === 'FontAwesome5' ?
                <FontAwesome5 name={icon} size={20} color={isDestructive ? styles.destructiveText.color : styles.menuIcon.color} style={styles.menuIcon} />
                : <MaterialIcons name={icon} size={22} color={isDestructive ? styles.destructiveText.color : styles.menuIcon.color} style={styles.menuIcon} />
            }
            <Text style={[styles.menuText, isDestructive && styles.destructiveText]}>{text}</Text>
            {!isDestructive && <FontAwesome5 name="chevron-right" size={14} color="#C5C5C7" />}
        </TouchableOpacity>
    );

    // --- Render Loading ---
    if (isLoading) {
        return (
            <SafeAreaView style={[styles.safeArea, styles.centered]}>
                <ActivityIndicator size="large" color="#0056b3" />
            </SafeAreaView>
        );
    }

    // --- MAIN RENDER ---
    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* --- User Info Header --- */}
                <View style={styles.userInfoHeader}>
                    <Image
                        source={user.avatarUrl ? { uri: user.avatarUrl } : DEFAULT_AVATAR}
                        style={styles.avatar}
                    />
                    <Text style={styles.userName}>{user.fullName}</Text>
                    <Text style={styles.userMssv}>MSSV: {user.studentId}</Text>
                    <TouchableOpacity style={styles.editProfileButton} onPress={() => Alert.alert("Thông báo", "Chức năng chỉnh sửa thông tin cá nhân đang phát triển.")}>
                        <Text style={styles.editProfileText}>Chỉnh sửa thông tin</Text>
                    </TouchableOpacity>
                </View>

                {/* --- Quick Actions (Mã QR, Thẻ Sinh viên) --- */}
                <View style={styles.quickActionsContainer}>
                    <TouchableOpacity style={styles.quickActionButton} onPress={() => handleNavigateTo('QRCodeScreen')}>
                        <FontAwesome5 name="qrcode" size={22} color="#0056b3" />
                        <Text style={styles.quickActionText}>Mã QR</Text>
                    </TouchableOpacity>
                    <View style={styles.quickActionSeparator} />
                    <TouchableOpacity style={styles.quickActionButton} onPress={() => handleNavigateTo('StudentCardScreen')}>
                        <FontAwesome5 name="id-card" size={22} color="#0056b3" />
                        <Text style={styles.quickActionText}>Thẻ Sinh viên</Text>
                    </TouchableOpacity>
                </View>

                {/* --- Menu Section: Hỗ trợ --- */}
                <View style={styles.menuSection}>
                    <Text style={styles.menuSectionTitle}>HỖ TRỢ</Text>
                    <MenuItem icon="phone-alt" text="Liên hệ" onPress={() => Linking.openURL('tel:18001577')} />
                    <View style={styles.menuSeparator} />
                    <MenuItem icon="video" text="Video Hướng dẫn" onPress={() => Alert.alert("Thông báo","Xem video trên kênh YouTube của HSU.")} />
                </View>

                {/* --- Menu Section: Ứng dụng --- */}
                <View style={styles.menuSection}>
                    <Text style={styles.menuSectionTitle}>ỨNG DỤNG</Text>
                    <MenuItem icon="cog" text="Cài đặt chung" onPress={() => handleNavigateTo('GeneralSettingsScreen')} />
                    {/* <View style={styles.menuSeparator} />
                    <MenuItem icon="shield-alt" text="Bảo mật & Quyền riêng tư" onPress={() => handleNavigateTo('SecuritySettingsScreen')} />
                    <View style={styles.menuSeparator} />
                    <MenuItem icon="bell" text="Thông báo" onPress={() => handleNavigateTo('NotificationSettingsScreen')} /> */}
                </View>

                {/* --- Logout Button --- */}
                <View style={[styles.menuSection, {marginTop: 20}]}>
                     <MenuItem icon="sign-out-alt" text="Đăng xuất" onPress={handleLogout} isDestructive />
                </View>

                {/* --- App Version --- */}
                <Text style={styles.appVersion}>Phiên bản 4.0.0 (HSUAPPNEW)</Text>

            </ScrollView>
        </SafeAreaView>
    );
};

// --- StyleSheet (Thiết kế lại theo Hình 2) ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F0F2F5' }, // Màu nền xám nhạt
    container: { flex: 1 },
    scrollContent: { paddingBottom: 30 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // User Info Header
    userInfoHeader: {
        backgroundColor: '#0056b3', // Màu xanh HSU đậm
        paddingTop: Platform.OS === 'android' ? 30 : 20,
        paddingBottom: 20,
        alignItems: 'center',
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        marginBottom: 20,
    },
    avatar: {
        width: 90,
        height: 90,
        borderRadius: 45,
        borderWidth: 3,
        borderColor: '#FFFFFF',
        marginBottom: 12,
    },
    userName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    userMssv: {
        fontSize: 14,
        color: '#E0E0E0',
        marginBottom: 15,
    },
    editProfileButton: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 15,
    },
    editProfileText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '500',
    },

    // Quick Actions
    quickActionsContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        borderRadius: 12,
        paddingVertical: 10, // Giảm padding
        marginTop: -35, // Để nó đè lên phần header một chút
        marginBottom: 25,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    quickActionButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
    },
    quickActionText: {
        marginTop: 8,
        fontSize: 13,
        color: '#0056b3',
        fontWeight: '500',
    },
    quickActionSeparator: {
        width: 1,
        backgroundColor: '#E0E0E0',
        marginVertical: 8,
    },

    // Menu Section
    menuSection: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        borderRadius: 12,
        marginBottom: 15,
        overflow: 'hidden', // Để bo góc cho separator
    },
    menuSectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#666666',
        paddingHorizontal: 16,
        paddingTop: 15,
        paddingBottom: 8,
        textTransform: 'uppercase',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 16,
    },
    menuIcon: {
        width: 24, // Kích thước icon cố định
        textAlign: 'center',
        marginRight: 16,
        color: '#4F4F4F',
    },
    menuText: {
        flex: 1,
        fontSize: 16,
        color: '#333333',
    },
    destructiveText: {
        color: '#FF3B30', // Màu đỏ cho destructive actions
        fontWeight: '500',
    },
    menuSeparator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#E0E0E0',
        marginLeft: 16 + 24 + 16, // iconWidth + iconMarginRight + paddingHorizontal
    },

    // App Version
    appVersion: {
        textAlign: 'center',
        fontSize: 12,
        color: '#8E8E93',
        marginTop: 20,
        marginBottom: 10,
    },
});

export default AccountSettingsScreen;