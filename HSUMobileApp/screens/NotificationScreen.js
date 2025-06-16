// HSUMobileApp/screens/NotificationScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet,Platform,
    ActivityIndicator, Alert, RefreshControl, Modal, Linking, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { API_BASE_URL } from '@env';
import NotificationItem from './components/NotificationItem'; // Đường dẫn đến component con

const BASE_URL = API_BASE_URL; // <<< ANH NHỚ THAY IP VÀ PORT ĐÚNG >>>

const NotificationScreen = () => {
    const navigation = useNavigation();
    const isMountedRef = useRef(true);

    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const [selectedNotification, setSelectedNotification] = useState(null);
    const [isModalVisible, setIsModalVisible] = useState(false);

    // Biến tạm để tránh nhiều Alert do lỗi token cùng lúc
    let tokenErrorAlertVisible = false;

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    const fetchNotifications = useCallback(async (isPullToRefresh = false) => {
        if (!isMountedRef.current) return;
        if (!isPullToRefresh) setIsLoading(true);
        setError(null);
        let token;

        try {
            token = await AsyncStorage.getItem('userToken');
            if (!token) {
                throw new Error("Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.");
            }

            console.log("[NotificationScreen] Fetching notifications with token...");
            const response = await fetch(`${BASE_URL}/api/notifications/my`, { // Giả sử endpoint là /my
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!isMountedRef.current) return;
            const responseText = await response.text();
            if (!isMountedRef.current) return;

            let result;
            try { result = JSON.parse(responseText); }
            catch (e) {
                console.error("[NotificationScreen] JSON Parse Error:", responseText.substring(0, 500));
                throw new Error(`Lỗi không mong muốn từ server (Status: ${response.status}).`);
            }

            if (response.ok && result.success && Array.isArray(result.data)) {
                if (isMountedRef.current) {
                    console.log(`[NotificationScreen] Fetched ${result.data.length} notifications.`);
                    // Sắp xếp thông báo theo ngày tạo mới nhất
                    const sortedNotifications = result.data.sort((a, b) =>
                        new Date(b.createdAt || b.sentAt) - new Date(a.createdAt || a.sentAt)
                    );
                    setNotifications(sortedNotifications);
                }
            } else {
                throw new Error(result.message || `Lỗi tải danh sách thông báo (Code: ${response.status})`);
            }
        } catch (err) {
            console.error("[NotificationScreen] Fetch Error:", err);
            if (isMountedRef.current) {
                setError(err.message);
                setNotifications([]);
                const errorMsgLower = String(err.message).toLowerCase();
                if ((errorMsgLower.includes('token') || errorMsgLower.includes('xác thực') || err.message.includes('401')) && !tokenErrorAlertVisible) {
                    tokenErrorAlertVisible = true;
                    Alert.alert(
                        "Phiên làm việc hết hạn",
                        "Vui lòng đăng nhập lại để tiếp tục.",
                        [{ text: "OK", onPress: () => {
                            tokenErrorAlertVisible = false;
                            if (isMountedRef.current) navigation.replace('Login');
                        }}],
                        { cancelable: false }
                    );
                }
            }
        } finally {
            if (isMountedRef.current) {
                if (!isPullToRefresh) setIsLoading(false);
                setRefreshing(false);
            }
        }
    }, [navigation]);

    // Gọi API đánh dấu đã đọc
    const markNotificationAsRead = useCallback(async (notificationId) => {
        if (!notificationId || !isMountedRef.current) return;
        console.log(`[NotificationScreen] Marking notification ${notificationId} as read.`);
        try {
            const token = await AsyncStorage.getItem('userToken');
            if (!token) return; // Không làm gì nếu không có token

            await fetch(`${BASE_URL}/api/notifications/${notificationId}/mark-as-read`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}` }
            });
            // Không cần chờ response hoàn chỉnh nếu không quan trọng, hoặc có thể xử lý response
            console.log(`[NotificationScreen] Sent mark-as-read for ${notificationId}`);
        } catch (error) {
            console.error(`[NotificationScreen] Error marking notification ${notificationId} as read:`, error);
        }
    }, []);

    useFocusEffect(useCallback(() => {
        tokenErrorAlertVisible = false; // Reset cờ khi màn hình focus
        fetchNotifications();
    }, [fetchNotifications]));

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        fetchNotifications(true);
    }, [fetchNotifications]);

    const handleViewDetail = useCallback((item) => {
        setSelectedNotification(item);
        setIsModalVisible(true);

        if (!item.isRead) {
            markNotificationAsRead(item._id);
            // Cập nhật UI ngay lập tức
            if (isMountedRef.current) {
                setNotifications(prevNotifications =>
                    prevNotifications.map(notif =>
                        notif._id === item._id ? { ...notif, isRead: true } : notif
                    )
                );
            }
        }
    }, [markNotificationAsRead]);

    const renderEmptyList = () => (
        <View style={styles.centeredMessageContainer}>
            <FontAwesome5 name="bell-slash" size={40} color="#bdc3c7" style={{ marginBottom: 15 }} />
            <Text style={styles.emptyListText}>Bạn chưa có thông báo nào.</Text>
        </View>
    );

    const renderListError = () => (
        <View style={styles.centeredMessageContainer}>
            <FontAwesome5 name="exclamation-circle" size={40} color="#e74c3c" style={{ marginBottom: 15 }} />
            <Text style={styles.errorTitleText}>Không thể tải thông báo</Text>
            {error && <Text style={styles.errorDetailText}>{String(error)}</Text>}
            <TouchableOpacity style={styles.retryLoadButton} onPress={() => fetchNotifications(false)} disabled={isLoading || refreshing}>
                <Text style={styles.retryLoadButtonText}>Thử lại</Text>
            </TouchableOpacity>
        </View>
    );

    if (isLoading && notifications.length === 0 && !error) {
        return <SafeAreaView style={styles.safeArea}><View style={styles.centeredMessageContainer}><ActivityIndicator size="large" color="#0056b3" /></View></SafeAreaView>;
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            {error && notifications.length === 0 && !isLoading && !refreshing ? renderListError() : (
                <FlatList
                    data={notifications}
                    renderItem={({ item }) => <NotificationItem item={item} onPress={() => handleViewDetail(item)} />}
                    keyExtractor={(item) => item._id?.toString() || `notif-${Math.random()}`} // Nên có _id
                    contentContainerStyle={notifications.length === 0 ? styles.centeredMessageContainer : styles.listContainer}
                    ListEmptyComponent={!isLoading && !error && !refreshing ? renderEmptyList : null}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            colors={["#0056b3"]}
                            tintColor={"#0056b3"}
                        />
                    }
                />
            )}

            {selectedNotification && (
                <Modal
                    animationType="fade"
                    transparent={true}
                    visible={isModalVisible}
                    onRequestClose={() => setIsModalVisible(false)}
                >
                    <TouchableOpacity
                        style={styles.modalOverlay}
                        activeOpacity={1}
                        onPressOut={() => setIsModalVisible(false)}
                    >
                        <TouchableOpacity style={styles.modalContent} activeOpacity={1}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle} numberOfLines={3}>{selectedNotification.title}</Text>
                                <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeButton}>
                                    <FontAwesome5 name="times" size={20} color="#6c757d" />
                                </TouchableOpacity>
                            </View>
                            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                                <Text style={styles.modalFullContent}>
                                    {selectedNotification.fullContent || selectedNotification.shortDescription || "Không có nội dung chi tiết."}
                                </Text>
                                {selectedNotification.link && (
                                    <TouchableOpacity
                                        style={styles.modalLinkButton}
                                        onPress={() => Linking.openURL(selectedNotification.link).catch(err => Alert.alert("Lỗi", "Không thể mở liên kết này."))}
                                    >
                                        <Text style={styles.modalLinkText}>Xem chi tiết tại đây</Text>
                                        <FontAwesome5 name="external-link-alt" size={14} color="#FFFFFF" style={{marginLeft: 8}}/>
                                    </TouchableOpacity>
                                )}
                            </ScrollView>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </Modal>
            )}
        </SafeAreaView>
    );
};

// --- StyleSheet ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F0F2F5' },
    listContainer: { paddingBottom: 10, }, // Bỏ paddingTop nếu item đầu tiên đã có padding
    centeredMessageContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyListText: { fontSize: 16, color: '#6c757d', textAlign: 'center' },
    errorTitleText: { fontSize: 17, fontWeight: 'bold', color: '#c0392b', textAlign: 'center', marginBottom: 8 },
    errorDetailText: { fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 18, lineHeight: 20 },
    retryLoadButton: { backgroundColor: '#0056b3', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 8 },
    retryLoadButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 25, // Thu hẹp modal một chút
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14, // Bo góc nhiều hơn
        paddingTop: 20, // Padding trên cho tiêu đề
        paddingBottom: 25, // Padding dưới
        paddingHorizontal: 20,
        width: '100%',
        maxHeight: '75%',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start', // Để title có thể wrap nếu dài
        borderBottomWidth: 1,
        borderBottomColor: '#EAEAEA',
        paddingBottom: 15,
        marginBottom: 15,
    },
    modalTitle: {
        fontSize: 17, // Kích thước title lớn hơn
        fontWeight: '600', // Đậm vừa
        color: '#1c1c1e', // Màu chữ tối hơn
        flex: 1,
        marginRight: 10,
    },
    closeButton: {
        padding: 8, // Tăng vùng chạm cho dễ bấm
        marginLeft: 10,
    },
    modalBody: {
        // Không cần maxHeight ở đây nữa vì modalContent đã giới hạn
    },
    modalFullContent: {
        fontSize: 15,
        lineHeight: 23, // Tăng line height cho dễ đọc
        color: '#3c3c43',
        textAlign: Platform.OS === 'ios' ? 'justify' : 'left', // Căn đều cho iOS
    },
    modalLinkButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignSelf: 'center', // Căn giữa nút
        marginTop: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    modalLinkText: {
        fontSize: 15,
        color: '#FFFFFF',
        fontWeight: '500',
        textAlign: 'center',
    },
});

export default NotificationScreen;