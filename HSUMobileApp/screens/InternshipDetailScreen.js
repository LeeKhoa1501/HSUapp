// HSUMobileApp/screens/InternshipDetailScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator,
    TouchableOpacity, Linking, Alert, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontAwesome5 } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import vi from 'date-fns/locale/vi';
import { API_BASE_URL } from '@env';

// --- CONFIGURATION ---
const BASE_URL = API_BASE_URL;// <<< THAY IP VÀ PORT ĐÚNG >>>

// --- HELPER FUNCTIONS ---
const formatDateDisplay = (dateString) => {
    if (!dateString) return 'Chưa cập nhật';
    try { return format(parseISO(dateString), 'dd/MM/yyyy', { locale: vi }); }
    catch (error) {
        try { return format(new Date(dateString), 'dd/MM/yyyy', { locale: vi }); }
        catch (ex) {
            console.warn("[Helper] formatDateDisplay error for date:", dateString, ex);
            return 'Ngày không hợp lệ';
        }
    }
};

const getStatusInfo = (status) => {
    const statusStr = String(status || 'Không rõ').toLowerCase();
    switch (statusStr) {
        case 'pending': case 'pending_approval': return { text: 'Chờ duyệt', badgeColor: '#fff3cd', textColor: '#856404' };
        case 'approved': return { text: 'Đã duyệt', badgeColor: '#d1e7dd', textColor: '#0f5132' };
        case 'rejected': return { text: 'Đã từ chối', badgeColor: '#f8d7da', textColor: '#721c24' };
        case 'inprogress': case 'in_progress': return { text: 'Đang thực tập', badgeColor: '#cce5ff', textColor: '#004085' };
        case 'completed': return { text: 'Hoàn thành', badgeColor: '#d4edda', textColor: '#155724' };
        case 'cancelled': return { text: 'Đã hủy', badgeColor: '#e9ecef', textColor: '#495057' };
        default: return { text: statusStr.charAt(0).toUpperCase() + statusStr.slice(1), badgeColor: '#6c757d', textColor: '#fff' };
    }
};

const INTERNSHIP_TYPES_MAP = {
    'nhan_thuc': 'TT. Nhận thức',
    'kien_tap': 'Kiến tập',
    'tot_nghiep': 'TT. Tốt nghiệp',
    'du_an_doanh_nghiep': 'D.án Doanh nghiệp',
    'other': 'Khác'
};
const getInternshipTypeLabel = (value) => INTERNSHIP_TYPES_MAP[value] || String(value || 'N/A');


// --- SUB-COMPONENTS ---
const InfoRowItem = React.memo(({ iconName, label, value, valueStyle, isLink = false, linkPrefix = '' }) => {
    const valueExists = !(value === null || typeof value === 'undefined' || String(value).trim() === '');
    const displayValue = valueExists ? String(value) : 'Chưa cập nhật';

    if (!label && !valueExists && String(label || '').toLowerCase() !== 'trạng thái:') {
        return null;
    }

    return (
        <View style={styles.infoRowContainer}>
            {iconName && typeof iconName === 'string' && iconName.trim() !== '' &&
                <FontAwesome5 name={iconName} size={14} color="#0056b3" style={styles.infoRowIcon} />}
            <Text style={styles.infoRowLabel}>{String(label || '')}:</Text>
            {isLink && valueExists && displayValue !== 'Chưa cập nhật' ? (
                <TouchableOpacity onPress={() => Linking.openURL(linkPrefix + displayValue).catch(() => Alert.alert("Lỗi", `Không thể mở liên kết: ${displayValue}`))}>
                    <Text style={[styles.infoRowValue, styles.linkValue, valueStyle]}>{displayValue}</Text>
                </TouchableOpacity>
            ) : (
                <Text style={[styles.infoRowValue, valueStyle, !valueExists && styles.valueNotUpdated]}>{displayValue}</Text>
            )}
        </View>
    );
});

const ActionButton = React.memo(({ onPress, text, icon, buttonStyle, isLoading, disabled }) => (
    <TouchableOpacity
        style={[styles.actionButton, buttonStyle, (isLoading || disabled) && styles.disabledButton]}
        onPress={onPress}
        disabled={isLoading || disabled}
    >
        {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
        ) : (
            icon && typeof icon === 'string' && icon.trim() !== '' &&
            <FontAwesome5 name={icon} size={18} color="#fff" style={styles.actionButtonIcon} />
        )}
        <Text style={styles.actionButtonText}>{text || ''}</Text>
    </TouchableOpacity>
));


// --- MAIN COMPONENT: InternshipDetailScreen ---
const InternshipDetailScreen = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { requestId } = route.params || {};

    const [internshipDetail, setInternshipDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    const fetchInternshipDetail = useCallback(async () => {
        if (!isMountedRef.current) return;
        if (!requestId) { if (isMountedRef.current) { setError("ID đơn không hợp lệ."); setLoading(false); } return; }
        console.log(`[InternshipDetailScreen] Fetching detail for ID: ${requestId}`);
        if(isMountedRef.current) { setLoading(true); setError(null); }
        try {
            const token = await AsyncStorage.getItem('userToken');
            if (!token && isMountedRef.current) { Alert.alert("Lỗi Xác thực", "Vui lòng đăng nhập lại."); navigation.replace('Login'); setLoading(false); return; }
            const response = await fetch(`${BASE_URL}/api/internships/${requestId}`, { headers: { Authorization: `Bearer ${token}` }});
            const responseText = await response.text();
            if (!isMountedRef.current) { setLoading(false); return; }
            console.log(`[InternshipDetailScreen] Raw API Response (Status: ${response.status}) - Data: ${responseText.substring(0, 500)}`);
            let result;
            try { result = JSON.parse(responseText); }
            catch (e) { throw new Error(`Lỗi parse JSON từ server (Status: ${response.status}).`); }
            if (response.ok && result.success && result.data) {
                if (isMountedRef.current) {
                    console.log("[InternshipDetailScreen] Data received. User populated:", JSON.stringify(result.data.userId, null, 2));
                    setInternshipDetail(result.data);
                }
            } else { throw new Error(result.message || `Không thể tải chi tiết đơn (Code: ${response.status})`); }
        } catch (err) {
            console.error("[InternshipDetailScreen] Fetch Error:", err.message);
            if (isMountedRef.current) setError(err.message);
        } finally { if (isMountedRef.current) setLoading(false); }
    }, [requestId, navigation]);

    useEffect(() => { fetchInternshipDetail(); }, [fetchInternshipDetail]);

    useEffect(() => {
        if (internshipDetail) {
            navigation.setOptions({ title: `Đơn TT: ${internshipDetail.requestCode || 'Chi tiết'}` });
        }
    }, [internshipDetail, navigation]);

    const performStatusUpdateAPI = useCallback(async (actionPath, bodyData = null, successMessage, newStatusForUI) => {
        if (!isMountedRef.current || !internshipDetail?._id) {
            if (internshipDetail?._id) Alert.alert("Lỗi", "ID đơn không hợp lệ để thực hiện thao tác này.");
            return;
        }
        setIsActionLoading(true);
        try {
            const token = await AsyncStorage.getItem('userToken');
            if (!token) throw new Error("Vui lòng đăng nhập lại để thực hiện thao tác.");

            const response = await fetch(`${BASE_URL}/api/internships/${internshipDetail._id}/${actionPath}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: bodyData ? JSON.stringify(bodyData) : undefined
            });
            const result = await response.json();
            if (!isMountedRef.current) return;

            if (response.ok && result.success) {
                Alert.alert("Thành công", successMessage);
                setInternshipDetail(prev => ({ ...prev, ...(result.data || {}), status: newStatusForUI }));
            } else {
                throw new Error(result.message || "Thao tác thất bại. Vui lòng thử lại.");
            }
        } catch (err) {
            Alert.alert("Lỗi Thao Tác", err.message);
        } finally {
            if (isMountedRef.current) setIsActionLoading(false);
        }
    }, [internshipDetail]);

    const handleCancelRequest = useCallback(() => {
        Alert.alert("Xác nhận hủy", "Bạn có chắc chắn muốn hủy đơn thực tập này?", [
            { text: "Không", style: "cancel" },
            { text: "Có, hủy", onPress: () => performStatusUpdateAPI('cancel', null, 'Đơn xin thực tập của bạn đã được hủy.', 'Cancelled'), style: "destructive" }
        ]);
    }, [performStatusUpdateAPI]);
    
    // --- Render Logic ---
    if (loading) {
        return <SafeAreaView style={styles.centered}><ActivityIndicator size="large" color="#002366" /><Text style={styles.loadingText}>Đang tải chi tiết đơn...</Text></SafeAreaView>;
    }
    if (error || !internshipDetail) {
        return <SafeAreaView style={styles.centered}><FontAwesome5 name="exclamation-triangle" size={40} color="#c0392b" style={{marginBottom:15}} /><Text style={styles.errorText}>{error || "Không tìm thấy thông tin đơn thực tập."}</Text><TouchableOpacity onPress={fetchInternshipDetail} style={styles.retryButton} disabled={loading || isActionLoading}><Text style={styles.retryButtonText}>Thử lại</Text></TouchableOpacity></SafeAreaView>;
    }

    const {
        userId: populatedUserData,
        companyId: populatedCompanyData,
        receivingCampusId: populatedLocationData,
        semester, academicYear, internshipType,
        notes, status,
        companyNameOther, companyAddressOther, companyContactOther,
        requestDate, requestCode, startDate, endDate,
        rejectionReason, approvalNotes,
        studentClass: internshipRequestStudentClass
    } = internshipDetail;

    const statusInfo = getStatusInfo(status);

    const renderRequestSummary = () => (
        <View style={styles.card}>
            <Text style={styles.title}>Mã Đơn: {requestCode || 'N/A'}</Text>
            <InfoRowItem iconName="calendar-check" label="Ngày gửi" value={formatDateDisplay(requestDate || internshipDetail.createdAt)} />
            <View style={[styles.infoRowContainer, styles.statusRowAligned]}>
                <FontAwesome5 name="clipboard-check" size={14} color="#0056b3" style={styles.infoRowIcon} />
                <Text style={styles.infoRowLabel}>Trạng thái:</Text>
                <View style={[styles.statusDisplayBadge, { backgroundColor: statusInfo.badgeColor }]}>
                    <Text style={[styles.statusDisplayText, { color: statusInfo.textColor }]}>{statusInfo.text}</Text>
                </View>
            </View>
            {(status === 'Rejected' && (rejectionReason || internshipDetail.adminNotes)) &&
                <InfoRowItem iconName="comment-slash" label="Lý do từ chối" value={rejectionReason || internshipDetail.adminNotes} />
            }
            {(status === 'Approved' && (approvalNotes || internshipDetail.adminNotes)) &&
                <InfoRowItem iconName="comment-dots" label="Ghi chú duyệt" value={approvalNotes || internshipDetail.adminNotes} />
            }
        </View>
    );

    const renderStudentInfo = () => (
        <View style={styles.card}>
            <Text style={styles.title}>Thông Tin Sinh Viên</Text>
            <InfoRowItem iconName="user-graduate" label="Họ tên" value={populatedUserData?.fullName} />
            <InfoRowItem iconName="id-card" label="MSSV" value={populatedUserData?.studentId} />
            <InfoRowItem iconName="school" label="Lớp" value={internshipRequestStudentClass || populatedUserData?.studentClass} />
            <InfoRowItem iconName="graduation-cap" label="Ngành" value={populatedUserData?.majorName || populatedUserData?.major} />
            <InfoRowItem iconName="envelope" label="Email" value={populatedUserData?.email} />
        </View>
    );

    const renderInternshipDetails = () => (
        <View style={styles.card}>
            <Text style={styles.title}>Chi Tiết Đăng Ký Thực Tập</Text>
            <InfoRowItem iconName="briefcase" label="Loại hình" value={getInternshipTypeLabel(internshipType)} />
            <InfoRowItem iconName="calendar-alt" label="Học kỳ" value={`${semester || 'N/A'} (${academicYear || 'N/A'})`} />
            <InfoRowItem iconName="calendar-day" label="Ngày BĐ" value={formatDateDisplay(startDate)} />
            <InfoRowItem iconName="calendar-times" label="Ngày KT" value={formatDateDisplay(endDate)} />
            <InfoRowItem iconName="university" label="Nơi nhận HS" value={populatedLocationData?.name} />
            {notes ? <InfoRowItem iconName="pencil-alt" label="Ghi chú SV" value={notes} /> : null}
        </View>
    );

    const renderCompanyInfo = () => (
        <View style={styles.card}>
            <Text style={styles.title}>Thông Tin Công Ty Thực Tập</Text>
            <InfoRowItem iconName="building" label="Tên Công Ty" value={populatedCompanyData?.name || companyNameOther} />
            <InfoRowItem iconName="map-marker-alt" label="Địa chỉ" value={populatedCompanyData?.address || companyAddressOther} />
            {populatedCompanyData?.website ? <InfoRowItem iconName="globe-asia" label="Website" value={populatedCompanyData.website} isLink /> : null}
            {populatedCompanyData?.contactPerson ? <InfoRowItem iconName="user-tie" label="Người liên hệ" value={populatedCompanyData.contactPerson} /> :
             (!populatedCompanyData && companyContactOther) ? <InfoRowItem iconName="user-tie" label="Người liên hệ" value={companyContactOther} /> : null}
            {populatedCompanyData?.contactEmail ? <InfoRowItem iconName="at" label="Email Cty" value={populatedCompanyData.contactEmail} isLink linkPrefix="mailto:" /> : null}
            {populatedCompanyData?.contactPhone ? <InfoRowItem iconName="phone-alt" label="SĐT Cty" value={populatedCompanyData.contactPhone} isLink linkPrefix="tel:" /> : null}
        </View>
    );

    const renderActionButtons = () => {
        const lowerCaseStatus = String(status || "").toLowerCase();
        // Chỉ hiển thị nút hủy khi trạng thái là pending hoặc các biến thể của nó
        if (lowerCaseStatus === 'pending' || lowerCaseStatus === 'pending_approval') {
            return (
                <ActionButton 
                    onPress={handleCancelRequest} 
                    text="Hủy Đơn Thực Tập" 
                    icon="ban" 
                    buttonStyle={styles.cancelButton} 
                    isLoading={isActionLoading} 
                />
            );
        }
        return null;
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                contentContainerStyle={styles.scrollContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {renderRequestSummary()}
                {renderStudentInfo()}
                {renderInternshipDetails()}
                {renderCompanyInfo()}
                {renderActionButtons()}
                <View style={{ height: 30 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

// --- StyleSheet ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f0f2f5' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    loadingText: { marginTop: 10, fontSize: 15, color: '#555'},
    errorText: { color: '#c0392b', fontSize: 16, textAlign: 'center', fontWeight:'500', lineHeight: 22 },
    retryButton: { backgroundColor: '#003974', paddingVertical: 12, paddingHorizontal: 30, borderRadius:8, marginTop:15},
    retryButtonText: { color: '#fff', fontWeight:'bold', fontSize:15},
    scrollContainer: { paddingHorizontal: 12, paddingTop: 15, paddingBottom: 20, flexGrow: 1 },
    card: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 18, paddingTop:18, paddingBottom:8, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2, },
    title: { fontSize: 17, fontWeight: 'bold', color: '#002366', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#e9ecef', paddingBottom: 10, },
    infoRowContainer: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-start' },
    infoRowIcon: { marginRight: 10, width: 18, textAlign: 'center', color: '#0056b3', marginTop: 2 },
    infoRowLabel: { fontSize: 14, color: '#6c757d', fontWeight: '500', minWidth: 100, marginRight: 5 },
    infoRowValue: { fontSize: 14, color: '#212529', flex: 1, lineHeight: 20, },
    valueNotUpdated: { fontStyle: 'italic', color: '#6c757d'},
    linkValue: { color: '#007bff', textDecorationLine: 'underline' },
    statusRowAligned: { alignItems: 'center' },
    statusDisplayBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, alignSelf:'flex-start' },
    statusDisplayText: { fontWeight: 'bold', fontSize: 13, },
    actionButton: { flexDirection: 'row', paddingVertical: 13, paddingHorizontal:20, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10, marginHorizontal: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2, },
    actionButtonIcon: { marginRight: 8 },
    disabledButton: { backgroundColor: '#ced4da' },
    cancelButton: { backgroundColor: '#dc3545' }, // Thay đổi màu nút hủy cho nổi bật
    actionButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

export default InternshipDetailScreen;