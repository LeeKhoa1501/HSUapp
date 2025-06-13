// HSUMobileApp/screens/AcademicRequestDetailScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {View, Text, StyleSheet, ScrollView, ActivityIndicator,TouchableOpacity, Linking, Alert, Platform} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontAwesome5 } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import vi from 'date-fns/locale/vi';
// === SỬA TÊN HÀM IMPORT CHO KHỚP VỚI requestTypes.js ===
import { getRequestTypeLabel } from '../assets/data/requestTypes'; // Đảm bảo đường dẫn này đúng

const BASE_URL = 'http://10.101.39.47:5000'; // <<< THAY IP VÀ PORT ĐÚNG >>>

// Helper functions
const formatDateDisplay = (dateString) => { 
    if (!dateString) return 'Chưa cập nhật';
    try { return format(parseISO(dateString), 'dd/MM/yyyy', { locale: vi }); }
    catch (error) { try { return format(new Date(dateString), 'dd/MM/yyyy', { locale: vi }); }
        catch (ex) { return 'Ngày không hợp lệ'; }
    }
};
const getAcademicStatusInfo = (status) => {
    const statusStr = String(status || 'Không rõ').toLowerCase();
    // (Giữ nguyên switch case của Khoa)
    switch (statusStr) {
        case 'pending': return { text: 'Chờ xử lý', badgeColor: '#fff3cd', textColor: '#856404' };
        case 'processing': return { text: 'Đang xử lý', badgeColor: '#cce5ff', textColor: '#004085' };
        case 'approved': return { text: 'Đã duyệt', badgeColor: '#d1e7dd', textColor: '#0f5132' };
        case 'completed': return { text: 'Đã hoàn tất', badgeColor: '#d4edda', textColor: '#155724' };
        case 'rejected': return { text: 'Đã từ chối', badgeColor: '#f8d7da', textColor: '#721c24' };
        case 'cancelled': return { text: 'Đã hủy', badgeColor: '#e9ecef', textColor: '#495057' };
        default: return { text: statusStr.charAt(0).toUpperCase() + statusStr.slice(1), badgeColor: '#6c757d', textColor: '#fff' };
    }
};

// Component hiển thị một dòng thông tin (Icon, Label, Value)
const InfoRowItem = React.memo(({ iconName, label, value, valueStyle, isLink = false, linkPrefix = '' }) => {
    const valueExists = !(value === null || typeof value === 'undefined' || String(value).trim() === '');
    const displayValue = valueExists ? String(value) : 'Chưa cập nhật';

    // Không render nếu cả label và value đều không có ý nghĩa (trừ trạng thái)
    if (!label && !valueExists && String(label || '').toLowerCase() !== 'trạng thái:') {
        return null;
    }

    return (
        <View style={styles.infoRowContainer}>
            {iconName && <FontAwesome5 name={iconName} size={14} color="#495057" style={styles.infoRowIcon} />}
            <Text style={styles.infoRowLabel}>{String(label || '')}:</Text>
            {isLink && valueExists && displayValue !== 'Chưa cập nhật' ? (
                <TouchableOpacity onPress={() => Linking.openURL(linkPrefix + displayValue).catch(() => Alert.alert("Lỗi", `Không thể mở: ${displayValue}`))}>
                    <Text style={[styles.infoRowValue, styles.linkValue, valueStyle]}>{displayValue}</Text>
                </TouchableOpacity>
            ) : (
                <Text style={[styles.infoRowValue, valueStyle, !valueExists && styles.valueNotUpdated]}>{displayValue}</Text>
            )}
        </View>
    );
});

// Component cho các nút hành động
const ActionButton = React.memo(({ onPress, text, icon, buttonStyle, textStyle, disabled, isLoading }) => (
    <TouchableOpacity
        style={[styles.actionButton, buttonStyle, disabled && styles.disabledButton]}
        onPress={onPress}
        disabled={disabled || isLoading}
    >
        {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
        ) : (
            icon && <FontAwesome5 name={icon} size={18} color="#fff" style={{marginRight: 10}}/>
        )}
        <Text style={[styles.actionButtonText, textStyle]}>{text}</Text>
    </TouchableOpacity>
));

// --- MAIN COMPONENT: AcademicRequestDetailScreen 
const AcademicRequestDetailScreen = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { requestId } = route.params || {};

    // --- States ---
    const [requestDetail, setRequestDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isActionLoading, setIsActionLoading] = useState(false);

    // Ref để kiểm tra component còn mounted không, tránh lỗi update state trên unmounted component
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // --- API Calls ---
    const fetchRequestDetail = useCallback(async () => {
        if (!isMountedRef.current) return;
        if (!requestId) {
            setError("ID yêu cầu không hợp lệ.");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const token = await AsyncStorage.getItem('userToken');
            if (!token) {
                Alert.alert("Lỗi", "Vui lòng đăng nhập lại.");
                if (isMountedRef.current) navigation.replace('Login');
                return;
            }
            const response = await fetch(`${BASE_URL}/api/academic-requests/${requestId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const responseText = await response.text();
            if (!isMountedRef.current) return;

            let result;
            try { result = JSON.parse(responseText); }
            catch (e) { throw new Error(`Lỗi parse JSON (Status: ${response.status}). Phản hồi: ${responseText.substring(0, 200)}`); }

            if (response.ok && result.success && result.data) {
                if (isMountedRef.current) setRequestDetail(result.data);
            } else {
                throw new Error(result.message || `Không thể tải chi tiết YCHV (Code: ${response.status})`);
            }
        } catch (err) {
            if (isMountedRef.current) setError(err.message);
        } finally {
            if (isMountedRef.current) setLoading(false);
        }
    }, [requestId, navigation]);

    const performStatusUpdateAPI = useCallback(async (actionPath, bodyData = null, successMessage, newStatusForUI) => {
        if (!isMountedRef.current || !requestDetail?._id) {
            if (requestDetail?._id) Alert.alert("Lỗi", "ID yêu cầu không hợp lệ."); // Chỉ alert nếu có requestDetail
            return;
        }
        setIsActionLoading(true);
        try {
            const token = await AsyncStorage.getItem('userToken');
            if (!token) throw new Error("Vui lòng đăng nhập lại.");

            const response = await fetch(`${BASE_URL}/api/academic-requests/${requestDetail._id}/${actionPath}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: bodyData ? JSON.stringify(bodyData) : undefined
            });
            const result = await response.json(); // Giả sử API luôn trả về JSON
            if (!isMountedRef.current) return;

            if (response.ok && result.success) {
                Alert.alert("Thành công", successMessage);
                // Cập nhật UI ngay lập tức, có thể bao gồm cả các trường khác từ result.data
                setRequestDetail(prev => ({ ...prev, ...(result.data || {}), status: newStatusForUI }));
            } else {
                throw new Error(result.message || "Thao tác thất bại.");
            }
        } catch (err) { // Đổi tên biến lỗi để không trùng với error state
            Alert.alert("Lỗi", err.message);
        } finally {
            if (isMountedRef.current) setIsActionLoading(false);
        }
    }, [requestDetail]); // Thêm requestDetail vào dependency array


    // --- Effects ---
    useEffect(() => {
        fetchRequestDetail();
    }, [fetchRequestDetail]); // Gọi khi component mount hoặc requestId thay đổi

    useEffect(() => {
        if (requestDetail) {
            navigation.setOptions({ title: `YCHV: ${requestDetail.requestCode || 'Chi tiết'}` });
        }
    }, [requestDetail, navigation]);

    // --- Action Handlers ---
    const handleCancelRequest = useCallback(() => {
        Alert.alert(
            "Xác nhận hủy",
            "Bạn có chắc chắn muốn hủy yêu cầu này?",
            [
                { text: "Không", style: "cancel" },
                { text: "Có, hủy", onPress: () => performStatusUpdateAPI('cancel', null, 'Yêu cầu của bạn đã được hủy.', 'Cancelled'), style: "destructive" }
            ]
        );
    }, [performStatusUpdateAPI]);

    const handleApproveDemo = useCallback(() => {
        Alert.alert(
            "Duyệt Yêu Cầu (Demo)",
            "Bạn có muốn giả lập duyệt yêu cầu này?",
            [
                { text: "Không", style: "cancel" },
                { text: "Duyệt", onPress: () => performStatusUpdateAPI('approve', { adminNotes: 'Đã duyệt (Demo)' }, 'Yêu cầu đã được duyệt (Demo).', 'Approved') }
            ]
        );
    }, [performStatusUpdateAPI]);

    const handleRejectDemo = useCallback(() => {
        const confirmReject = (reason) => {
            if (!reason || String(reason).trim() === "") {
                Alert.alert("Lỗi", "Vui lòng cung cấp lý do từ chối.");
                return;
            }
            performStatusUpdateAPI('reject', { adminNotes: String(reason).trim() }, 'Yêu cầu đã bị từ chối (Demo).', 'Rejected');
        };

        if (Platform.OS === 'ios') {
            Alert.prompt(
                "Lý do từ chối (Demo)",
                "Vui lòng nhập lý do:",
                [
                    { text: "Hủy", style: "cancel" },
                    { text: "Từ chối", onPress: confirmReject, style: "destructive" }
                ],
                'plain-text',
                '' // Giá trị mặc định của input
            );
        } else { // Android không có Alert.prompt
            // Có thể dùng một Modal tùy chỉnh để nhập text hoặc đơn giản là một lý do mặc định
            Alert.alert(
                "Từ chối Yêu Cầu (Demo)",
                "Bạn có muốn từ chối yêu cầu này với lý do 'Demo (Android)'?",
                [
                    { text: "Không", style: "cancel" },
                    { text: "Từ chối", onPress: () => confirmReject("Lý do từ chối (Demo Android)."), style: "destructive" }
                ]
            );
        }
    }, [performStatusUpdateAPI]);


    // --- Render Logic ---
    if (loading) {
        return (
            <SafeAreaView style={styles.centered}>
                <ActivityIndicator size="large" color="#002366" />
                <Text style={styles.loadingText}>Đang tải chi tiết yêu cầu...</Text>
            </SafeAreaView>
        );
    }

    if (error || !requestDetail) {
        return (
            <SafeAreaView style={styles.centered}>
                <FontAwesome5 name="exclamation-triangle" size={40} color="#c0392b" style={{ marginBottom: 15 }} />
                <Text style={styles.errorText}>{error || "Không tìm thấy thông tin yêu cầu này."}</Text>
                <TouchableOpacity onPress={fetchRequestDetail} style={styles.retryButton} disabled={loading || isActionLoading}>
                    <Text style={styles.retryButtonText}>Thử lại</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // Destructure sau khi đã chắc chắn requestDetail có dữ liệu
    const { userId: user, requestType, requestTitle, requestDate, studentNotes, status, adminNotes, receivingCampusId, requestCode, createdAt } = requestDetail;
    const statusInfo = getAcademicStatusInfo(status);

    // --- Render Sections ---
    const renderRequestInfo = () => (
        <View style={styles.card}>
            <Text style={styles.title}>Mã Yêu Cầu: {requestCode || 'N/A'}</Text>
            <InfoRowItem iconName="file-alt" label="Loại yêu cầu" value={getRequestTypeLabel(requestType)} />
            <InfoRowItem iconName="heading" label="Tiêu đề" value={requestTitle} />
            <InfoRowItem iconName="calendar-check" label="Ngày gửi" value={formatDateDisplay(requestDate || createdAt)} />
            <View style={[styles.infoRowContainer, styles.statusRowAligned]}>
                <FontAwesome5 name="clipboard-check" size={14} color="#495057" style={styles.infoRowIcon} />
                <Text style={styles.infoRowLabel}>Trạng thái:</Text>
                <View style={[styles.statusDisplayBadge, { backgroundColor: statusInfo.badgeColor }]}>
                    <Text style={[styles.statusDisplayText, { color: statusInfo.textColor }]}>{statusInfo.text}</Text>
                </View>
            </View>
            {receivingCampusId && <InfoRowItem iconName="university" label="Nơi nhận KQ" value={receivingCampusId.name} />}
        </View>
    );

    const renderStudentInfo = () => (
        user ? ( // Kiểm tra user tồn tại trước khi render
            <View style={styles.card}>
                <Text style={styles.title}>Thông Tin Sinh Viên</Text>
                <InfoRowItem iconName="user-graduate" label="Họ tên" value={user.fullName} />
                <InfoRowItem iconName="id-badge" label="MSSV" value={user.studentId} />
                <InfoRowItem iconName="school" label="Lớp" value={user.studentClass || 'Chưa có'} />
            </View>
        ) : null
    );

    const renderStudentNotes = () => (
        studentNotes && (
            <View style={styles.card}>
                <Text style={styles.title}>Nội dung Yêu Cầu / Ghi chú SV</Text>
                <Text style={styles.notesContentText}>{studentNotes}</Text>
            </View>
        )
    );

    const renderAdminNotes = () => (
        adminNotes && (
            <View style={styles.card}>
                <Text style={styles.title}>Phản hồi từ Phòng Ban</Text>
                <Text style={styles.notesContentText}>{adminNotes}</Text>
            </View>
        )
    );

    const renderActionButtons = () => (
        // Chỉ hiển thị nút Hủy và các nút Demo khi trạng thái là 'Pending'
        status === 'Pending' && (
            <>
                <ActionButton
                    onPress={handleCancelRequest}
                    text="Hủy Yêu Cầu"
                    icon="ban"
                    buttonStyle={styles.cancelButton}
                    isLoading={isActionLoading}
                    disabled={isActionLoading}
                />
                <View style={styles.adminActionContainer}>
                    <Text style={styles.adminActionTitle}>Hành động Giả Lập (Demo)</Text>
                    <ActionButton
                        onPress={handleApproveDemo}
                        text="Giả Lập Duyệt"
                        icon="check-circle"
                        buttonStyle={styles.approveButton}
                        isLoading={isActionLoading}
                        disabled={isActionLoading}
                    />
                    <ActionButton
                        onPress={handleRejectDemo}
                        text="Giả Lập Từ Chối"
                        icon="times-circle"
                        buttonStyle={styles.rejectButton}
                        isLoading={isActionLoading}
                        disabled={isActionLoading}
                    />
                </View>
            </>
        )
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                contentContainerStyle={styles.scrollContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled" // Giúp TouchableOpacity trong ScrollView hoạt động tốt hơn
            >
                {renderRequestInfo()}
                {renderStudentInfo()}
                {renderStudentNotes()}
                {renderAdminNotes()}
                {renderActionButtons()}
                <View style={{ height: 30 }} /> 
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f0f2f5' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    loadingText: { marginTop: 10, fontSize: 15, color: '#555' },
    errorText: { color: '#c0392b', fontSize: 16, textAlign: 'center', fontWeight: '500', lineHeight: 22 },
    retryButton: { backgroundColor: '#003974', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8, marginTop: 15 },
    retryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    scrollContainer: { paddingHorizontal: 12, paddingTop: 15, paddingBottom: 20, flexGrow: 1 },
    card: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 8, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2, },
    title: { fontSize: 17, fontWeight: 'bold', color: '#002366', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#e9ecef', paddingBottom: 10, },
    infoRowContainer: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-start' }, // alignItems: 'flex-start' cho text dài
    infoRowIcon: { marginRight: 10, width: 18, textAlign: 'center', color: '#0056b3', marginTop: 2 }, // marginTop nhỏ để icon thẳng hàng với dòng đầu text
    infoRowLabel: { fontSize: 14, color: '#6c757d', fontWeight: '500', minWidth: 100, marginRight: 5 },
    infoRowValue: { fontSize: 14, color: '#212529', flex: 1, lineHeight: 20, },
    valueNotUpdated: { fontStyle: 'italic', color: '#6c757d' },
    linkValue: { color: '#007bff', textDecorationLine: 'underline' },
    statusRowAligned: { alignItems: 'center' }, // Giữ lại center cho dòng trạng thái
    statusDisplayBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, alignSelf: 'flex-start' },
    statusDisplayText: { fontWeight: 'bold', fontSize: 13, },
    actionButton: { flexDirection: 'row', paddingVertical: 13, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10, marginHorizontal: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2, },
    disabledButton: { backgroundColor: '#ced4da' }, // Style cho nút bị vô hiệu hóa
    cancelButton: { backgroundColor: '#6c757d' },
    approveButton: { backgroundColor: '#28a745', marginBottom: 10, },
    rejectButton: { backgroundColor: '#dc3545' },
    actionButtonText: { color: '#fff', fontSize: 15, fontWeight: '600', marginLeft: 8 }, // Giảm marginLeft nếu không có icon hoặc icon nhỏ
    adminActionContainer: { marginTop: 20, paddingTop: 15, marginHorizontal: 5, borderTopWidth: 1, borderColor: '#e0e0e0', },
    adminActionTitle: { textAlign: 'center', fontSize: 13, color: '#777', marginBottom: 12, fontStyle: 'italic', fontWeight: '500' },
    notesContentText: { fontSize: 15, lineHeight: 22, color: '#333', paddingVertical: 5 }
});

export default AcademicRequestDetailScreen;