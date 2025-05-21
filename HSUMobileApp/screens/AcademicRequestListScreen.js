// HSUMobileApp/screens/AcademicRequestListScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { format, parseISO } from 'date-fns';
import vi from 'date-fns/locale/vi';
import { getAcademicRequestTypeLabel } from '../assets/data/requestTypes'; // Đảm bảo đường dẫn này đúng

const BASE_URL = 'http://10.101.38.213:5000'; // <<< ANH NHỚ THAY IP VÀ PORT ĐÚNG >>>

const getStatusStyle = (status) => {
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
    try { return format(parseISO(dateString), 'dd/MM/yy', { locale: vi }); }
    catch (e) { try { return format(new Date(dateString), 'dd/MM/yy', { locale: vi }); } catch (ex) { return 'N/A'; } }
};

const AcademicRequestItem = React.memo(({ item, onPress }) => {
    const { label: statusLabel, badgeColor, textColor } = getStatusStyle(item.status);
    return (
        <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.itemHeader}>
                <Text style={styles.itemRequestCode} numberOfLines={1}>{item.requestCode || 'Chưa có mã'}</Text>
                <View style={[styles.itemStatusBadge, { backgroundColor: badgeColor }]}>
                    <Text style={[styles.itemStatusText, { color: textColor }]}>{statusLabel}</Text>
                </View>
            </View>
            <View style={styles.itemRow}>
                <FontAwesome5 name="file-signature" size={13} color="#5f6368" style={styles.itemIcon}/>
                <Text style={styles.itemTextValue} numberOfLines={2}> {item.requestTitle || getAcademicRequestTypeLabel(item.requestType)}</Text>
            </View>
            <View style={styles.itemRow}>
                <FontAwesome5 name="calendar-alt" size={13} color="#5f6368" style={styles.itemIcon}/>
                <Text style={styles.itemTextValue}> Ngày gửi: {formatDateSimple(item.requestDate || item.createdAt)}</Text>
            </View>
            {item.studentNotes && (
                <View style={styles.itemRow}>
                    <FontAwesome5 name="sticky-note" size={13} color="#5f6368" style={styles.itemIcon}/>
                    <Text style={[styles.itemTextValue, styles.notePreview]} numberOfLines={1}> Nội dung: {item.studentNotes}</Text>
                </View>
            )}
            <View style={styles.itemArrowContainer}>
                <FontAwesome5 name="chevron-right" size={16} color="#b0bec5" />
            </View>
        </TouchableOpacity>
    );
});

const AcademicRequestListScreen = () => {
    const navigation = useNavigation();
    const [requests, setRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const isMountedRef = useRef(true);

    useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);

    const fetchMyAcademicRequests = useCallback(async (isRefreshing = false) => {
        if (!isMountedRef.current) return;
        if (!isRefreshing) setIsLoading(true); setError(null);
        let token;
        try {
            token = await AsyncStorage.getItem('userToken');
            if (!token) { throw new Error("Token không hợp lệ. Vui lòng đăng nhập lại."); }
            const response = await fetch(`${BASE_URL}/api/academic-requests/my`, { headers: { Authorization: `Bearer ${token}` }});
            if (!isMountedRef.current) return;
            const responseText = await response.text();
            if (!isMountedRef.current) return;
            let result;
            try { result = JSON.parse(responseText); }
            catch (e) { console.error("[AcadRequestList] JSON Parse Error:", responseText.substring(0, 500)); throw new Error(`Lỗi parse JSON từ server. (Status: ${response.status})`); }

            if (response.ok && result.success && Array.isArray(result.data)) {
                 if (isMountedRef.current) setRequests(result.data);
            } else { throw new Error(result.message || `Lỗi tải danh sách YCHV (${response.status})`); }
        } catch (err) {
            if (isMountedRef.current) {
                setError(err.message); setRequests([]);
                if (String(err.message).toLowerCase().includes('token') || String(err.message).toLowerCase().includes('401')) {
                    if (!Alert.alertVisible) { Alert.alertVisible = true; Alert.alert("Phiên làm việc hết hạn", "Vui lòng đăng nhập lại.", [{ text: "OK", onPress: () => { Alert.alertVisible = false; navigation.replace('Login'); }}], { cancelable: false }); }
                }
            }
        } finally { if (isMountedRef.current) { if (!isRefreshing) setIsLoading(false); setRefreshing(false); } }
    }, [navigation]);

    useFocusEffect(useCallback(() => { fetchMyAcademicRequests(); }, [fetchMyAcademicRequests]));
    const handleRefresh = useCallback(() => { setRefreshing(true); fetchMyAcademicRequests(true); }, [fetchMyAcademicRequests]);

    const handleViewDetail = useCallback((item) => {
    if (item && item._id && typeof item._id === 'string') {
        console.log("[AcadRequestList] Navigating to AcademicRequestDetailScreen with requestId:", item._id);
        navigation.navigate('AcademicRequestDetailScreen', { requestId: item._id });
    } else {
        Alert.alert("Lỗi", "Không thể xem chi tiết do thiếu ID yêu cầu hợp lệ.");
        console.error("[AcadRequestList] Lỗi khi xem chi tiết: item._id không hợp lệ.", item);
    }
}, [navigation]);

    const renderEmptyList = () => ( <View style={styles.centeredMessageContainer}><FontAwesome5 name="folder-open" size={60} color="#ced4da" style={{marginBottom: 20}}/><Text style={styles.emptyListText}>Bạn chưa có yêu cầu học vụ nào.</Text><Text style={styles.emptyListHint}>Nhấn nút "+" để tạo yêu cầu mới.</Text></View> );
    const renderListError = () => ( <View style={styles.centeredMessageContainer}><FontAwesome5 name="exclamation-circle" size={60} color="#e74c3c" style={{marginBottom: 20}}/><Text style={styles.errorTitleText}>Không thể tải dữ liệu</Text>{error && <Text style={styles.errorDetailText}>{String(error)}</Text>}<TouchableOpacity style={styles.retryLoadButton} onPress={() => fetchMyAcademicRequests(true)}><Text style={styles.retryLoadButtonText}>Thử lại</Text></TouchableOpacity></View> );

    if (isLoading && requests.length === 0) {
        return <SafeAreaView style={styles.safeArea}><View style={styles.centeredMessageContainer}><ActivityIndicator size="large" color="#002366" /></View></SafeAreaView>;
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            {error && requests.length === 0 && !isLoading ? renderListError() : (
                 <FlatList data={requests} renderItem={({ item }) => <AcademicRequestItem item={item} onPress={() => handleViewDetail(item)} />} keyExtractor={(item, index) => item._id ? item._id.toString() : `acadReq-${index}-${Math.random()}`} contentContainerStyle={requests.length === 0 ? styles.centeredMessageContainer : styles.listContainer} ListEmptyComponent={!isLoading && !error ? renderEmptyList : null} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={["#002366"]} tintColor={"#002366"} />} />
            )}
            <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AcademicRequestFormScreen')}>
                <FontAwesome5 name="plus" size={20} color="#fff" />
            </TouchableOpacity>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({ 
    safeArea: { flex: 1, backgroundColor: '#f4f6f8' }, listContainer: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 80 }, itemCard: { backgroundColor: '#ffffff', padding: 16, marginBottom: 12, borderRadius: 10, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2.5, }, itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, itemRequestCode: { fontSize: 15, fontWeight: 'bold', color: '#003974', flexShrink: 1, marginRight: 8 }, itemStatusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 }, itemStatusText: { fontSize: 11, fontWeight: '600' }, itemRow: { flexDirection:'row', alignItems:'center', marginBottom: 6 }, itemIcon: { width: 18, marginRight:8, color:'#5f6368', marginTop:1 }, itemTextValue: { fontSize: 13, color: '#3c4043', flex: 1 }, notePreview: { fontStyle: 'italic', color: '#777'}, itemArrowContainer: { position: 'absolute', right: 16, top: '50%', transform: [{ translateY: -8 }] }, centeredMessageContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }, emptyListText: { fontSize: 17, color: '#495057', textAlign: 'center', marginBottom: 8, fontWeight:'500' }, emptyListHint: { fontSize: 14, color: '#6c757d', textAlign: 'center' }, errorTitleText: { fontSize: 18, fontWeight: 'bold', color: '#c0392b', textAlign: 'center', marginBottom: 10 }, errorDetailText: { fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 20, lineHeight:20 }, retryLoadButton: { backgroundColor: '#0056b3', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8 }, retryLoadButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 }, fab: { position: 'absolute', margin: 16, right: 15, bottom: 25, backgroundColor: '#0056b3', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, }
});
export default AcademicRequestListScreen;