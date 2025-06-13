// HSUMobileApp/screens/AcademicRequestListScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl,Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { format, parseISO } from 'date-fns';
import vi from 'date-fns/locale/vi';
import { getAcademicRequestTypeLabel } from '../assets/data/requestTypes'; // Đảm bảo đường dẫn này đúng

const BASE_URL = 'http://10.101.39.47:5000'; // <<<  THAY IP VÀ PORT ĐÚNG >>>

// --- HELPER FUNCTIONS ---
const getStatusStyle = (status) => {
    // (Giữ nguyên logic của Khoa)
    const s = String(status || 'Không rõ').toLowerCase();
    if (s === 'pending') return { label: 'Chờ xử lý', badgeColor: '#fff3cd', textColor: '#856404' };
    if (s === 'processing') return { label: 'Đang xử lý', badgeColor: '#cce5ff', textColor: '#004085' };
    if (s === 'approved' || s === 'completed') return { label: 'Đã hoàn tất', badgeColor: '#d1e7dd', textColor: '#0f5132' };
    if (s === 'rejected') return { label: 'Đã từ chối', badgeColor: '#f8d7da', textColor: '#721c24' };
    if (s === 'cancelled') return { label: 'Đã hủy', badgeColor: '#e9ecef', textColor: '#495057' };
    return { label: s.charAt(0).toUpperCase() + s.slice(1), badgeColor: '#6c757d', textColor: '#fff' };
};

const formatDateSimple = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        return format(parseISO(dateString), 'dd/MM/yy', { locale: vi });
    } catch (e) {
        try { // Thử parse bằng new Date nếu parseISO thất bại
            return format(new Date(dateString), 'dd/MM/yy', { locale: vi });
        } catch (ex) {
            console.warn("formatDateSimple error:", dateString, ex);
            return 'N/A';
        }
    }
};

// --- SUB-COMPONENT: AcademicRequestItem ---
const AcademicRequestItem = React.memo(({ item, onPress }) => {
    if (!item || !item._id) { // Kiểm tra item hợp lệ
        console.warn("[AcademicRequestItem] Invalid item data:", item);
        return null;
    }
    const { label: statusLabel, badgeColor, textColor } = getStatusStyle(item.status);
    const displayTitle = item.requestTitle || getAcademicRequestTypeLabel(item.requestType) || 'Yêu cầu không có tiêu đề';
    const displayDate = formatDateSimple(item.requestDate || item.createdAt);

    return (
        <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.itemHeader}>
                <Text style={styles.itemRequestCode} numberOfLines={1}>{item.requestCode || 'N/A'}</Text>
                <View style={[styles.itemStatusBadge, { backgroundColor: badgeColor }]}>
                    <Text style={[styles.itemStatusText, { color: textColor }]}>{statusLabel}</Text>
                </View>
            </View>
            <View style={styles.itemRow}>
                <FontAwesome5 name="file-signature" size={13} color="#5f6368" style={styles.itemIcon} />
                <Text style={styles.itemTextValue} numberOfLines={2}> {displayTitle}</Text>
            </View>
            <View style={styles.itemRow}>
                <FontAwesome5 name="calendar-alt" size={13} color="#5f6368" style={styles.itemIcon} />
                <Text style={styles.itemTextValue}> Ngày gửi: {displayDate}</Text>
            </View>
            {item.studentNotes && (
                <View style={styles.itemRow}>
                    <FontAwesome5 name="sticky-note" size={13} color="#5f6368" style={styles.itemIcon} />
                    <Text style={[styles.itemTextValue, styles.notePreview]} numberOfLines={1}> Nội dung: {item.studentNotes}</Text>
                </View>
            )}
            <View style={styles.itemArrowContainer}>
                <FontAwesome5 name="chevron-right" size={16} color="#b0bec5" />
            </View>
        </TouchableOpacity>
    );
});

// --- MAIN COMPONENT: AcademicRequestListScreen ---
const AcademicRequestListScreen = () => {
    const navigation = useNavigation();

    // --- States ---
    const [requests, setRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true); // Trạng thái loading ban đầu
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false); // Cho Pull-to-Refresh

    // Ref để kiểm tra component còn mounted
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // --- API Call: Fetch Academic Requests ---
    const fetchMyAcademicRequests = useCallback(async (isPullToRefresh = false) => {
        if (!isMountedRef.current) return;

        // Chỉ set isLoading nếu không phải là pull-to-refresh (để tránh indicator chồng chéo)
        if (!isPullToRefresh) {
            setIsLoading(true);
        }
        setError(null); // Reset lỗi mỗi khi fetch
        let token;

        try {
            token = await AsyncStorage.getItem('userToken');
            if (!token) {
                // Lỗi token này sẽ được xử lý trong Alert bên dưới và điều hướng
                throw new Error("Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.");
            }

            console.log("[AcadRequestList] Fetching with token...");
            const response = await fetch(`${BASE_URL}/api/academic-requests/my`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!isMountedRef.current) return; // Kiểm tra sau mỗi await

            const responseText = await response.text();
            if (!isMountedRef.current) return;

            let result;
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                console.error("[AcadRequestList] JSON Parse Error:", responseText.substring(0, 500));
                throw new Error(`Lỗi không mong muốn từ server (Status: ${response.status}). Vui lòng thử lại.`);
            }

            if (response.ok && result.success && Array.isArray(result.data)) {
                if (isMountedRef.current) {
                    console.log(`[AcadRequestList] Fetched ${result.data.length} requests.`);
                    setRequests(result.data);
                }
            } else {
                // Ném lỗi với message từ server nếu có, hoặc một message chung
                throw new Error(result.message || `Không thể tải danh sách YCHV (Code: ${response.status})`);
            }
        } catch (err) {
            console.error("[AcadRequestList] Fetch Error:", err);
            if (isMountedRef.current) {
                setError(err.message);
                setRequests([]); // Xóa danh sách cũ khi có lỗi
                // Xử lý lỗi token và điều hướng về Login
                const errorMsgLower = String(err.message).toLowerCase();
                if (errorMsgLower.includes('token') || errorMsgLower.includes('401') || response?.status === 401) {
                    // Đảm bảo Alert chỉ hiển thị một lần
                    if (!Alert.alertVisible) {
                        Alert.alertVisible = true; // Một biến tạm để tránh nhiều Alert
                        Alert.alert(
                            "Phiên làm việc hết hạn",
                            "Vui lòng đăng nhập lại để tiếp tục.",
                            [{ text: "OK", onPress: () => {
                                Alert.alertVisible = false;
                                if (isMountedRef.current) navigation.replace('Login');
                            }}],
                            { cancelable: false }
                        );
                    }
                }
            }
        } finally {
            if (isMountedRef.current) {
                if (!isPullToRefresh) setIsLoading(false);
                setRefreshing(false);
            }
        }
    }, [navigation]); // navigation là dependency cho việc điều hướng

    // --- Effects ---
    // Tải dữ liệu khi màn hình được focus (ví dụ: khi quay lại từ màn hình tạo mới)
    useFocusEffect(
        useCallback(() => {
            console.log("[AcadRequestList] Screen Focused, fetching requests...");
            fetchMyAcademicRequests();
        }, [fetchMyAcademicRequests])
    );

    // --- Handlers ---
    const handleRefresh = useCallback(() => {
        console.log("[AcadRequestList] Handling Pull to Refresh...");
        setRefreshing(true);
        fetchMyAcademicRequests(true); // true để báo là pull-to-refresh
    }, [fetchMyAcademicRequests]);

    const handleViewDetail = useCallback((item) => {
        if (item && item._id && typeof item._id === 'string') {
            console.log("[AcadRequestList] Navigating to DetailScreen with requestId:", item._id);
            navigation.navigate('AcademicRequestDetailScreen', { requestId: item._id });
        } else {
            Alert.alert("Lỗi", "Không thể xem chi tiết do thiếu ID yêu cầu hợp lệ.");
            console.error("[AcadRequestList] Invalid item for detail view:", item);
        }
    }, [navigation]);

    const handleCreateNew = useCallback(() => {
        console.log("[AcadRequestList] Navigating to FormScreen...");
        navigation.navigate('AcademicRequestFormScreen');
    }, [navigation]);

    // --- Render Helper Components ---
    const renderEmptyList = () => (
        <View style={styles.centeredMessageContainer}>
            <FontAwesome5 name="folder-open" size={50} color="#ced4da" style={{ marginBottom: 20 }} />
            <Text style={styles.emptyListText}>Bạn chưa có yêu cầu học vụ nào.</Text>
            <Text style={styles.emptyListHint}>Nhấn nút "+" ở góc dưới để tạo yêu cầu mới.</Text>
        </View>
    );

    const renderListError = () => (
        <View style={styles.centeredMessageContainer}>
            <FontAwesome5 name="exclamation-circle" size={50} color="#e74c3c" style={{ marginBottom: 20 }} />
            <Text style={styles.errorTitleText}>Không thể tải dữ liệu</Text>
            {error && <Text style={styles.errorDetailText}>{String(error)}</Text>}
            <TouchableOpacity style={styles.retryLoadButton} onPress={() => fetchMyAcademicRequests(false)} disabled={isLoading || refreshing}>
                <Text style={styles.retryLoadButtonText}>Thử lại</Text>
            </TouchableOpacity>
        </View>
    );

    // --- Render Logic ---
    if (isLoading && requests.length === 0 && !error) { // Chỉ hiển thị loading toàn màn hình khi tải lần đầu và chưa có lỗi
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.centeredMessageContainer}>
                    <ActivityIndicator size="large" color="#002366" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Hiển thị lỗi nếu có lỗi và không có dữ liệu (và không đang loading) */}
            {error && requests.length === 0 && !isLoading && !refreshing ? renderListError() : (
                <FlatList
                    data={requests}
                    renderItem={({ item }) => <AcademicRequestItem item={item} onPress={() => handleViewDetail(item)} />}
                    // Sử dụng item._id làm key, nếu không có thì dùng index (nên hạn chế)
                    keyExtractor={(item) => item?._id?.toString() || `item-${Math.random()}`}
                    contentContainerStyle={requests.length === 0 ? styles.centeredMessageContainer : styles.listContainer}
                    ListEmptyComponent={!isLoading && !error && !refreshing ? renderEmptyList : null} // Chỉ hiển thị khi không loading, không lỗi, và không refreshing
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            colors={["#002366"]} // Màu cho Android
                            tintColor={"#002366"} // Màu cho iOS
                        />
                    }
                />
            )}
            <TouchableOpacity style={styles.fab} onPress={handleCreateNew} activeOpacity={0.8}>
                <FontAwesome5 name="plus" size={20} color="#fff" />
            </TouchableOpacity>
        </SafeAreaView>
    );
};

// --- StyleSheet ---
// (Giữ nguyên StyleSheet của Khoa, anh đã xem và thấy khá tốt, có thể điều chỉnh màu sắc hoặc padding nếu muốn)
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f4f6f8' }, // Màu nền nhẹ nhàng
    listContainer: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 80 }, // Thêm padding bottom cho FAB
    itemCard: {
        backgroundColor: '#ffffff',
        padding: 16,
        marginBottom: 12,
        borderRadius: 10,
        elevation: 2, // Android shadow
        shadowColor: "#000", // iOS shadow
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 2.5,
    },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    itemRequestCode: { fontSize: 15, fontWeight: 'bold', color: '#003974', flexShrink: 1, marginRight: 8 }, // Màu HSU đậm
    itemStatusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },
    itemStatusText: { fontSize: 11, fontWeight: '600' }, // Chữ nhỏ hơn, đậm
    itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7 }, // Tăng khoảng cách giữa các dòng
    itemIcon: { width: 18, marginRight: 10, color: '#5f6368', marginTop: 1 }, // Icon nhỏ hơn, màu nhạt hơn
    itemTextValue: { fontSize: 14, color: '#3c4043', flex: 1, lineHeight: 18 }, // Tăng line height
    notePreview: { fontStyle: 'italic', color: '#6c757d' }, // Màu nhạt hơn cho preview
    itemArrowContainer: { position: 'absolute', right: 16, top: '50%', transform: [{ translateY: -8 }] }, // Căn giữa mũi tên
    centeredMessageContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyListText: { fontSize: 17, color: '#495057', textAlign: 'center', marginBottom: 8, fontWeight: '500' },
    emptyListHint: { fontSize: 14, color: '#6c757d', textAlign: 'center' },
    errorTitleText: { fontSize: 18, fontWeight: 'bold', color: '#c0392b', textAlign: 'center', marginBottom: 10 },
    errorDetailText: { fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
    retryLoadButton: { backgroundColor: '#0056b3', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8 }, // Nút retry rõ ràng hơn
    retryLoadButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 15, // Hoặc dùng Dimensions để căn giữa nếu muốn
        bottom: Platform.OS === 'ios' ? 30 : 25, // Điều chỉnh cho iOS
        backgroundColor: '#003974', // Màu HSU đậm
        width: 56, height: 56, // Kích thước chuẩn của FAB
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6, // Android shadow
        shadowColor: '#000', // iOS shadow
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 3.5,
    }
});

export default AcademicRequestListScreen;