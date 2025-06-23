// HSUMobileApp/screens/NotificationScreen.js
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet, Platform,
    ActivityIndicator, Alert, RefreshControl, Modal, Linking, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { API_BASE_URL } from '@env';
import NotificationItem from './components/NotificationItem'; // Đảm bảo đường dẫn này đúng

// --- CONFIGURATION ---
const BASE_URL = API_BASE_URL;

/**
 * Main screen component to display a list of notifications.
 * Allows viewing details in a modal and marking notifications as read individually or all at once.
 */
const NotificationScreen = () => {
    const navigation = useNavigation();
    const isMountedRef = useRef(true); // Tracks if the component is mounted

    // --- States ---
    const [notifications, setNotifications] = useState([]); // Array of notification objects
    const [isLoading, setIsLoading] = useState(true);       // For initial loading state
    const [error, setError] = useState(null);               // For storing fetch or other errors
    const [refreshing, setRefreshing] = useState(false);    // For pull-to-refresh state

    // State for the notification detail modal
    const [selectedNotification, setSelectedNotification] = useState(null);
    const [isModalVisible, setIsModalVisible] = useState(false);

    // State for "Mark all as read" button loading
    const [isMarkingAllAsRead, setIsMarkingAllAsRead] = useState(false);

    // Temporary flag to prevent multiple token error alerts
    let tokenErrorAlertVisible = false; // Consider using state for better management if ESLint complains

    // --- Lifecycle Effect (Mount/Unmount) ---
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // --- API Call: Fetch User's Notifications ---
    const fetchNotifications = useCallback(async (isPullToRefresh = false) => {
        if (!isMountedRef.current) return;
        if (!isPullToRefresh) setIsLoading(true);
        setError(null);
        let token;

        try {
            token = await AsyncStorage.getItem('userToken');
            if (!token) {
                throw new Error("Xác thực không thành công. Vui lòng đăng nhập lại.");
            }

            console.log("[NotificationScreen] Fetching notifications...");
            const response = await fetch(`${BASE_URL}/api/notifications/my`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!isMountedRef.current) return;
            const responseText = await response.text();
            if (!isMountedRef.current) return;

            let result;
            try { result = JSON.parse(responseText); }
            catch (e) {
                console.error("[NotificationScreen] Fetch JSON Parse Error:", responseText.substring(0, 500));
                throw new Error(`Lỗi phản hồi từ server (Mã: ${response.status}).`);
            }

            if (response.ok && result.success && Array.isArray(result.data)) {
                if (isMountedRef.current) {
                    const sortedNotifications = result.data.sort((a, b) =>
                        new Date(b.createdAt || b.sentAt || 0) - new Date(a.createdAt || a.sentAt || 0)
                    );
                    setNotifications(sortedNotifications);
                }
            } else {
                throw new Error(result.message || `Lỗi tải danh sách thông báo (Mã: ${response.status})`);
            }
        } catch (err) {
            console.error("[NotificationScreen] Fetch Error:", err);
            if (isMountedRef.current) {
                setError(err.message);
                setNotifications([]);
                const errorMsgLower = String(err.message).toLowerCase();
                const statusCode = err.message.includes('Code: ') ? parseInt(err.message.split('Code: ')[1].replace(')','')) : (err.message.includes('Status: ') ? parseInt(err.message.split('Status: ')[1].replace(').','')) : null);

                if ((errorMsgLower.includes('token') || errorMsgLower.includes('xác thực') || statusCode === 401) && !tokenErrorAlertVisible) {
                    tokenErrorAlertVisible = true;
                    Alert.alert(
                        "Phiên làm việc hết hạn", "Vui lòng đăng nhập lại để tiếp tục.",
                        [{ text: "OK", onPress: () => { tokenErrorAlertVisible = false; if (isMountedRef.current) navigation.replace('Login'); }}],
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

    // --- API Call: Mark a Single Notification as Read ---
    const markSingleNotificationAsReadAPI = useCallback(async (notificationId) => {
        if (!notificationId || !isMountedRef.current) return false;
        console.log(`[NotificationScreen] Calling API to mark notification ${notificationId} as read.`);
        try {
            const token = await AsyncStorage.getItem('userToken');
            if (!token) return false;
            const response = await fetch(`${BASE_URL}/api/notifications/${notificationId}/mark-as-read`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log(`[NotificationScreen] Mark-as-read API response status for ${notificationId}: ${response.status}`);
            // Backend nên trả về JSON success:true nếu thành công
            if (response.ok) {
                try {
                    const result = await response.json();
                    return result.success;
                } catch (e) { // Nếu response.ok nhưng body không phải JSON (ví dụ 204 No Content)
                    return true; // Coi như thành công nếu status là 2xx
                }
            }
            return false;
        } catch (error) {
            console.error(`[NotificationScreen] Error API marking notification ${notificationId} as read:`, error);
            return false;
        }
    }, []);

    // --- API Call: Mark All Notifications as Read ---
    const markAllNotificationsAsReadAPI = useCallback(async () => {
        if (!isMountedRef.current) return false;
        console.log(`[NotificationScreen] Calling API to mark all notifications as read.`);
        setIsMarkingAllAsRead(true);
        let token;
        try {
            token = await AsyncStorage.getItem('userToken');
            if (!token) throw new Error("Vui lòng đăng nhập lại.");

            const response = await fetch(`${BASE_URL}/api/notifications/mark-all-as-read`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}` }
            });
            const responseText = await response.text(); // Đọc text trước
            if (!isMountedRef.current) { setIsMarkingAllAsRead(false); return false; }

            let result;
            try { result = JSON.parse(responseText); }
            catch (e) {
                // Nếu parse lỗi, kiểm tra xem response có phải là OK không (200, 204)
                if (response.ok) {
                    console.log("[NotificationScreen] Mark all as read: Server responded OK but not JSON. Assuming success.");
                    result = { success: true, message: "Đã đánh dấu tất cả đã đọc." };
                } else {
                    console.error("[NotificationScreen] Mark All As Read JSON Parse Error:", responseText.substring(0, 200));
                    throw new Error(`Lỗi phản hồi từ server (Mã: ${response.status}).`);
                }
            }

            if (response.ok && result.success) {
                return true;
            } else {
                throw new Error(result.message || "Không thể đánh dấu tất cả đã đọc trên server.");
            }
        } catch (err) {
            console.error("[NotificationScreen] Mark All As Read API Error:", err);
            if (isMountedRef.current) Alert.alert("Lỗi", err.message);
            return false;
        } finally {
            if (isMountedRef.current) setIsMarkingAllAsRead(false);
        }
    }, [navigation]);

    // --- Effects ---
    useFocusEffect(useCallback(() => {
        tokenErrorAlertVisible = false;
        console.log("[NotificationScreen] Screen focused. Fetching notifications.");
        fetchNotifications();
    }, [fetchNotifications]));

    // --- Event Handlers ---
    const handleRefresh = useCallback(() => {
        console.log("[NotificationScreen] Pull-to-refresh initiated.");
        setRefreshing(true);
        fetchNotifications(true);
    }, [fetchNotifications]);

    const handleViewDetail = useCallback(async (item) => {
        setSelectedNotification(item);
        setIsModalVisible(true);
        if (!item.isRead) {
            const markedOnServer = await markSingleNotificationAsReadAPI(item._id);
            if (markedOnServer && isMountedRef.current) {
                console.log(`[NotificationScreen] UI Update: Marking ${item._id} as read locally.`);
                setNotifications(prev => prev.map(n => n._id === item._id ? { ...n, isRead: true } : n));
            } else if(!markedOnServer) {
                console.warn(`[NotificationScreen] Failed to sync read status for ${item._id} with server.`);
            }
        }
    }, [markSingleNotificationAsReadAPI]);

    const handleMarkAllAsReadPress = useCallback(async () => {
        const unread = notifications.filter(n => !n.isRead);
        if (unread.length === 0) {
            Alert.alert("Thông báo", "Tất cả thông báo đã được đọc.");
            return;
        }
        const success = await markAllNotificationsAsReadAPI();
        if (success && isMountedRef.current) {
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            Alert.alert("Thành công", "Đã đánh dấu tất cả thông báo là đã đọc.");
        }
    }, [markAllNotificationsAsReadAPI, notifications]);

    // --- Render Helper Components ---
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
            {error && <Text style={styles.errorDetailText}>{String(error.message || error)}</Text>}
            <TouchableOpacity style={styles.retryLoadButton} onPress={() => fetchNotifications(false)} disabled={isLoading || refreshing}>
                <Text style={styles.retryLoadButtonText}>Thử lại</Text>
            </TouchableOpacity>
        </View>
    );

    const hasUnreadNotifications = useMemo(() => notifications.some(n => !n.isRead), [notifications]);

    // --- Initial Loading or Error State ---
    if (isLoading && notifications.length === 0 && !error) {
        return <SafeAreaView style={[styles.safeArea, styles.centeredMessageContainer]}><ActivityIndicator size="large" color="#0056b3" /></SafeAreaView>;
    }

    // --- MAIN RENDER ---
    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.listHeaderContainer}>
                <Text style={styles.listHeaderTitle}>Thông báo</Text>
                {hasUnreadNotifications && !isLoading && !(error && notifications.length === 0) && (
                    <TouchableOpacity onPress={handleMarkAllAsReadPress} disabled={isMarkingAllAsRead} style={styles.markAllReadButton}>
                        {isMarkingAllAsRead ? <ActivityIndicator size="small" color="#007AFF" /> : <Text style={styles.markAllReadText}>Đọc tất cả</Text>}
                    </TouchableOpacity>
                )}
            </View>

            {error && notifications.length === 0 && !isLoading && !refreshing ? renderListError() : (
                <FlatList
                    data={notifications}
                    renderItem={({ item }) => <NotificationItem item={item} onPress={() => handleViewDetail(item)} />}
                    keyExtractor={(item) => item._id?.toString() || `notif-item-${item.title}-${Math.random()}`} // Cải thiện key fallback
                    contentContainerStyle={notifications.length === 0 ? styles.centeredMessageContainer : styles.listContentContainer}
                    ListEmptyComponent={!isLoading && !error && !refreshing ? renderEmptyList : null}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={["#0056b3"]} tintColor={"#0056b3"} />}
                    extraData={notifications}
                />
            )}

            {selectedNotification && (
                <Modal
                    animationType="fade"
                    transparent={true}
                    visible={isModalVisible}
                    onRequestClose={() => setIsModalVisible(false)}
                >
                    <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPressOut={() => setIsModalVisible(false)}>
                        <TouchableOpacity style={styles.modalContent} activeOpacity={1}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle} numberOfLines={3}>{selectedNotification.title}</Text>
                                <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeButton}><FontAwesome5 name="times" size={20} color="#6c757d" /></TouchableOpacity>
                            </View>
                            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                                <Text style={styles.modalFullContent}>{selectedNotification.fullContent || selectedNotification.shortDescription || "Không có nội dung chi tiết."}</Text>
                                {selectedNotification.link && (
                                    <TouchableOpacity style={styles.modalLinkButton} onPress={() => Linking.openURL(selectedNotification.link).catch(err => Alert.alert("Lỗi", "Không thể mở liên kết này."))}>
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
// (Giữ nguyên StyleSheet từ phiên bản trước, đã bao gồm các style cho header và modal)
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F0F2F5' },
    listContentContainer: { paddingBottom: 10, },
    centeredMessageContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyListText: { fontSize: 16, color: '#6c757d', textAlign: 'center', fontWeight: '500' },
    errorTitleText: { fontSize: 17, fontWeight: 'bold', color: '#c0392b', textAlign: 'center', marginBottom: 8 },
    errorDetailText: { fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 18, lineHeight: 20 },
    retryLoadButton: { backgroundColor: '#0056b3', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 8 },
    retryLoadButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    listHeaderContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 10 : 14, paddingBottom: 10, backgroundColor: '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D1D1D6', },
    listHeaderTitle: { fontSize: Platform.OS === 'ios' ? 17 : 18, fontWeight: Platform.OS === 'ios' ? '600' : 'bold', color: '#1C1C1E', },
    markAllReadButton: { paddingVertical: 5, paddingHorizontal: 8, },
    markAllReadText: { fontSize: 14, color: '#007AFF', fontWeight: '500', },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 25, },
    modalContent: { backgroundColor: '#FFFFFF', borderRadius: 14, paddingTop: 20, paddingBottom: 25, paddingHorizontal: 20, width: '100%', maxHeight: '75%', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: '#EAEAEA', paddingBottom: 15, marginBottom: 15, },
    modalTitle: { fontSize: 17, fontWeight: '600', color: '#1c1c1e', flex: 1, marginRight: 10, },
    closeButton: { padding: 8, marginLeft: 10, },
    modalBody: { /* ... */ },
    modalFullContent: { fontSize: 15, lineHeight: 23, color: '#3c3c43', textAlign: Platform.OS === 'ios' ? 'justify' : 'left', },
    modalLinkButton: { backgroundColor: '#007AFF', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, alignSelf: 'center', marginTop: 20, flexDirection: 'row', alignItems: 'center', },
    modalLinkText: { fontSize: 15, color: '#FFFFFF', fontWeight: '500', textAlign: 'center', },
});

export default NotificationScreen;