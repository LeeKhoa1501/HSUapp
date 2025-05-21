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

const BASE_URL = 'http://10.101.38.213:5000'; // <<< ANH NHỚ THAY IP VÀ PORT ĐÚNG >>>

const formatDateDisplay = (dateString) => {
    if (!dateString) return 'Chưa cập nhật';
    try { return format(parseISO(dateString), 'dd/MM/yyyy', { locale: vi }); }
    catch (error) { try { return format(new Date(dateString), 'dd/MM/yyyy', { locale: vi }); }
        catch (ex) { return 'Ngày không hợp lệ'; }
    }
};
const getStatusInfo = (status) => {
    const statusStr = String(status || 'Không rõ');
    switch (statusStr.toLowerCase()) {
        case 'pending': case 'pending_approval': return { text: 'Chờ duyệt', badgeColor: '#fff3cd', textColor: '#856404' };
        case 'approved': return { text: 'Đã duyệt', badgeColor: '#d1e7dd', textColor: '#0f5132' };
        case 'rejected': return { text: 'Đã từ chối', badgeColor: '#f8d7da', textColor: '#721c24' };
        case 'inprogress': case 'in_progress': return { text: 'Đang thực tập', badgeColor: '#cce5ff', textColor: '#004085' };
        case 'completed': return { text: 'Hoàn thành', badgeColor: '#d4edda', textColor: '#155724' };
        case 'cancelled': return { text: 'Đã hủy', badgeColor: '#e9ecef', textColor: '#495057' };
        default: return { text: statusStr.charAt(0).toUpperCase() + statusStr.slice(1), badgeColor: '#6c757d', textColor: '#fff' };
    }
};
const getInternshipTypeLabel = (value) => {
    const types = { 'nhan_thuc': 'TT. Nhận thức', 'kien_tap': 'Kiến tập', 'tot_nghiep': 'TT. Tốt nghiệp', 'du_an_doanh_nghiep': 'D.án Doanh nghiệp', 'other': 'Khác' };
    return types[value] || String(value || 'N/A');
};

const InfoRowItem = React.memo(({ iconName, label, value, valueStyle, isLink = false, linkPrefix = '' }) => {
    const valueExists = !(value === null || typeof value === 'undefined' || String(value).trim() === '');
    const displayValue = valueExists ? String(value) : 'Chưa cập nhật';
    if (!label && !valueExists && (label||'').toLowerCase() !== 'trạng thái:') return null;
    return (
        <View style={styles.infoRowContainer}>
            {iconName && <FontAwesome5 name={iconName} size={14} color="#495057" style={styles.infoRowIcon} />}
            <Text style={styles.infoRowLabel}>{label || ''}:</Text>
            {isLink && valueExists && typeof displayValue === 'string' && displayValue !== 'Chưa cập nhật' ? (
                <TouchableOpacity onPress={() => Linking.openURL(linkPrefix + displayValue).catch(() => Alert.alert("Lỗi", `Không thể mở: ${displayValue}`))}>
                    <Text style={[styles.infoRowValue, styles.linkValue, valueStyle]}>{displayValue}</Text>
                </TouchableOpacity>
            ) : ( <Text style={[styles.infoRowValue, valueStyle, !valueExists && styles.valueNotUpdated]}>{displayValue}</Text> )}
        </View>
    );
});

const InternshipDetailScreen = () => {
    const route = useRoute(); const navigation = useNavigation();
    const { requestId } = route.params || {};
    const [internshipDetail, setInternshipDetail] = useState(null);
    const [loading, setLoading] = useState(true); const [error, setError] = useState(null);
    const [isActionLoading, setIsActionLoading] = useState(false); const isMountedRef = useRef(true);

    useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);

    const fetchInternshipDetail = useCallback(async () => {
        if (!requestId) { if (isMountedRef.current) { setError("ID đơn không hợp lệ hoặc không được cung cấp."); setLoading(false); } return; }
        if (isMountedRef.current) { setLoading(true); setError(null); }
        console.log(`[InternshipDetail] Bắt đầu fetch cho ID: ${requestId}`);
        try {
            const token = await AsyncStorage.getItem('userToken');
            if (!token) { Alert.alert("Lỗi", "Vui lòng đăng nhập lại."); if(isMountedRef.current) navigation.replace('Login'); return; }
            const response = await fetch(`${BASE_URL}/api/internships/${requestId}`, { headers: { Authorization: `Bearer ${token}` }});
            const responseText = await response.text();
            if (!isMountedRef.current) return;
            console.log(`[InternshipDetail] Raw API Response (first 300): ${responseText.substring(0,300)}`);
            let result;
            try { result = JSON.parse(responseText); }
            catch (e) { console.error("[InternshipDetail] Lỗi parse JSON:", e, "Response text:", responseText); throw new Error(`Lỗi parse JSON từ server. (Status: ${response.status})`); }
            if (response.ok && result.success && result.data) { if (isMountedRef.current) setInternshipDetail(result.data); }
            else { throw new Error(result.message || `Không thể tải chi tiết đơn (Code: ${response.status})`); }
        } catch (err) { if (isMountedRef.current) setError(err.message); }
        finally { if (isMountedRef.current) setLoading(false); }
    }, [requestId, navigation]);

    useEffect(() => { fetchInternshipDetail(); }, [fetchInternshipDetail]);
    useEffect(() => { if (internshipDetail) { navigation.setOptions({ title: `Đơn TT: ${internshipDetail.requestCode || 'Chi tiết'}` }); }}, [internshipDetail, navigation]);

    const performStatusUpdateAPI = async (actionPath, bodyData = null, successMessage, newStatusForUI) => {
        if (!internshipDetail?._id) { Alert.alert("Lỗi", "ID đơn không hợp lệ."); return; }
        if (isMountedRef.current) setIsActionLoading(true);
        try {
            const token = await AsyncStorage.getItem('userToken'); if (!token) throw new Error("Vui lòng đăng nhập lại.");
            const response = await fetch(`${BASE_URL}/api/internships/${internshipDetail._id}/${actionPath}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: bodyData ? JSON.stringify(bodyData) : undefined });
            const result = await response.json(); if (!isMountedRef.current) return;
            if (response.ok && result.success) { Alert.alert("Thành công", successMessage); setInternshipDetail(prev => ({ ...prev, ...result.data, status: newStatusForUI })); }
            else { throw new Error(result.message || "Thao tác thất bại."); }
        } catch (error) { Alert.alert("Lỗi", error.message); }
        finally { if (isMountedRef.current) setIsActionLoading(false); }
    };

    const handleCancelRequest = () => Alert.alert("Xác nhận hủy", "Hủy đơn thực tập này?", [{ text: "Không"}, { text: "Có, hủy", onPress: () => performStatusUpdateAPI('cancel', null, 'Đã hủy đơn xin thực tập.', 'Cancelled'), style: "destructive" }]);
    const handleApproveDemo = () => Alert.alert("Duyệt đơn (Demo)", "Duyệt đơn này?", [{ text: "Không"}, { text: "Duyệt", onPress: () => performStatusUpdateAPI('approve', { approvalNotes: 'Duyệt Demo' }, 'Đã duyệt đơn (Demo).', 'Approved') }]);
    const handleRejectDemo = () => {
        const confirm = (reason) => { if(!reason?.trim()){Alert.alert("Lỗi", "Cần lý do từ chối."); return;} performStatusUpdateAPI('reject', { rejectionReason: reason }, 'Đã từ chối (Demo).', 'Rejected');};
        if(Platform.OS === 'ios'){ Alert.prompt("Lý do từ chối (Demo)", "Nhập lý do:", [{text:"Hủy"},{text:"Từ chối", onPress:confirm, style:"destructive"}], 'plain-text','');}
        else{ Alert.alert("Từ chối (Demo)", "Từ chối với lý do 'Demo (Android)'?", [{text:"Không"},{text:"Từ chối", onPress:()=>confirm("Demo (Android)."), style:"destructive"}]);}
    };

    if (loading) { return <SafeAreaView style={styles.centered}><ActivityIndicator size="large" color="#002366" /><Text style={styles.loadingText}>Đang tải chi tiết đơn...</Text></SafeAreaView>; }
    if (error || !internshipDetail) { return <SafeAreaView style={styles.centered}><FontAwesome5 name="exclamation-triangle" size={40} color="#c0392b" style={{marginBottom:15}} /><Text style={styles.errorText}>{error || "Không tìm thấy thông tin đơn."}</Text><TouchableOpacity onPress={fetchInternshipDetail} style={styles.retryButton} disabled={loading || isActionLoading}><Text style={styles.retryButtonText}>Thử lại</Text></TouchableOpacity></SafeAreaView>; }

    const { user, companyId, semester, academicYear, internshipType, receivingCampusId, notes, status, companyNameOther, companyAddressOther, companyContactOther, requestDate, requestCode, startDate, endDate, rejectionReason, approvalNotes } = internshipDetail;
    const statusInfo = getStatusInfo(status);

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.card}><Text style={styles.title}>Mã Đơn: {requestCode || 'N/A'}</Text><InfoRowItem iconName="calendar-check" label="Ngày gửi" value={formatDateDisplay(requestDate || internshipDetail.createdAt)} /><View style={[styles.infoRowContainer, styles.statusRowAligned]}><FontAwesome5 name="clipboard-check" size={14} color="#495057" style={styles.infoRowIcon} /><Text style={styles.infoRowLabel}>Trạng thái:</Text><View style={[styles.statusDisplayBadge, { backgroundColor: statusInfo.badgeColor }]}><Text style={[styles.statusDisplayText, { color: statusInfo.textColor }]}>{statusInfo.text}</Text></View></View>{status === 'Rejected' && rejectionReason && <InfoRowItem iconName="comment-minus" label="Lý do từ chối" value={rejectionReason} />}{status === 'Approved' && approvalNotes && <InfoRowItem iconName="comment-check" label="Ghi chú duyệt" value={approvalNotes} />}</View>
                <View style={styles.card}><Text style={styles.title}>Thông Tin Sinh Viên</Text><InfoRowItem iconName="user-graduate" label="Họ tên" value={user?.fullName} /><InfoRowItem iconName="id-badge" label="MSSV" value={user?.studentId} /><InfoRowItem iconName="users-class" label="Lớp" value={internshipDetail.studentClass || user?.studentClass } /><InfoRowItem iconName="school" label="Ngành" value={user?.majorName || user?.major} /><InfoRowItem iconName="envelope" label="Email" value={user?.email} /></View>
                <View style={styles.card}><Text style={styles.title}>Chi Tiết Đăng Ký</Text><InfoRowItem iconName="briefcase" label="Loại hình" value={getInternshipTypeLabel(internshipType)} /><InfoRowItem iconName="calendar-alt" label="Học kỳ" value={`${semester || 'N/A'} (${academicYear || 'N/A'})`} /><InfoRowItem iconName="calendar-day" label="Ngày BĐ" value={formatDateDisplay(startDate)} /><InfoRowItem iconName="calendar-times" label="Ngày KT" value={formatDateDisplay(endDate)} /><InfoRowItem iconName="university" label="Nơi nhận" value={receivingCampusId?.name} />{notes && <InfoRowItem iconName="pencil-alt" label="Ghi chú" value={notes} />}</View>
                <View style={styles.card}><Text style={styles.title}>Thông Tin Công Ty</Text><InfoRowItem iconName="building" label="Tên Cty" value={companyId?.name || companyNameOther} /><InfoRowItem iconName="map-marker-alt" label="Địa chỉ" value={companyId?.address || companyAddressOther} />{companyId?.website && <InfoRowItem iconName="globe-asia" label="Website" value={companyId.website} isLink />}{companyId?.contactPerson && <InfoRowItem iconName="user-tie" label="Người LH Cty" value={companyId.contactPerson}/>}{companyNameOther && companyContactOther && <InfoRowItem iconName="user-tie" label="Người LH Cty" value={companyContactOther}/>}{companyId?.contactEmail && <InfoRowItem iconName="at" label="Email Cty" value={companyId.contactEmail} isLink linkPrefix="mailto:" />}{companyId?.contactPhone && <InfoRowItem iconName="phone-alt" label="SĐT Cty" value={companyId.contactPhone} isLink linkPrefix="tel:" />}</View>
                {(status === 'Pending') && (<TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={handleCancelRequest} disabled={isActionLoading}>{isActionLoading ? <ActivityIndicator color="#fff" size="small" /> : <FontAwesome5 name="ban" size={18} color="#fff" />}<Text style={styles.actionButtonText}>Hủy Đơn</Text></TouchableOpacity>)}
                {(status === 'Pending') && (<View style={styles.adminActionContainer}><Text style={styles.adminActionTitle}>Hành động Người Duyệt (Demo)</Text><TouchableOpacity style={[styles.actionButton, styles.approveButton]} onPress={handleApproveDemo} disabled={isActionLoading}>{isActionLoading ? <ActivityIndicator color="#fff" size="small"/> : <FontAwesome5 name="check-circle" size={18} color="#fff" />}<Text style={styles.actionButtonText}>Giả Lập DUYỆT</Text></TouchableOpacity><TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={handleRejectDemo} disabled={isActionLoading}>{isActionLoading ? <ActivityIndicator color="#fff" size="small"/> : <FontAwesome5 name="times-circle" size={18} color="#fff" />}<Text style={styles.actionButtonText}>Giả Lập TỪ CHỐI</Text></TouchableOpacity></View>)}
                <View style={{ height: 30 }} />
            </ScrollView>
        </SafeAreaView>
    );
};
const styles = StyleSheet.create({ /* ... STYLES GIỮ NGUYÊN NHƯ PHIÊN BẢN TRƯỚC ... */
    safeArea: { flex: 1, backgroundColor: '#f0f2f5' }, centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }, loadingText: { marginTop: 10, fontSize: 15, color: '#555'}, errorText: { color: '#c0392b', fontSize: 16, textAlign: 'center', fontWeight:'500', lineHeight: 22 }, retryButton: { backgroundColor: '#003974', paddingVertical: 12, paddingHorizontal: 30, borderRadius:8, marginTop:15}, retryButtonText: { color: '#fff', fontWeight:'bold', fontSize:15}, scrollContainer: { paddingHorizontal: 12, paddingTop: 15, paddingBottom: 20, flexGrow: 1 }, card: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 18, paddingTop:18, paddingBottom:8, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2, }, title: { fontSize: 17, fontWeight: 'bold', color: '#002366', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#e9ecef', paddingBottom: 10, }, infoRowContainer: { flexDirection: 'row', marginBottom: 12, alignItems: 'center' }, infoRowIcon: { marginRight: 10, width: 18, textAlign: 'center', color: '#0056b3'}, infoRowLabel: { fontSize: 14, color: '#6c757d', fontWeight: '500', minWidth: 110, marginRight:5 }, infoRowValue: { fontSize: 14, color: '#212529', flex: 1, lineHeight: 20, }, valueNotUpdated: { fontStyle: 'italic', color: '#6c757d'}, linkValue: { color: '#007bff', textDecorationLine: 'underline' }, statusRowAligned: { alignItems: 'center' }, statusDisplayBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, }, statusDisplayText: { fontWeight: 'bold', fontSize: 13, }, statusBadgePending: { backgroundColor: '#fff3cd' }, statusTextPending: { color: '#856404' }, statusBadgeApproved: { backgroundColor: '#d1e7dd' }, statusTextApproved: { color: '#0f5132' }, statusBadgeRejected: { backgroundColor: '#f8d7da' }, statusTextRejected: { color: '#721c24' }, statusBadgeInProgress: { backgroundColor: '#cce5ff' }, statusTextInProgress: { color: '#004085' }, statusBadgeCompleted: { backgroundColor: '#d4edda' }, statusTextCompleted: { color: '#155724' }, statusBadgeCancelled: { backgroundColor: '#e9ecef' }, statusTextCancelled: { color: '#495057' }, actionButton: { flexDirection: 'row', paddingVertical: 13, paddingHorizontal:20, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10, marginHorizontal: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2, }, cancelButton: { backgroundColor: '#6c757d' }, approveButton: { backgroundColor: '#28a745', marginBottom: 10, }, rejectButton: { backgroundColor: '#dc3545' }, actionButtonText: { color: '#fff', fontSize: 15, fontWeight: '600', marginLeft: 10 }, adminActionContainer: { marginTop: 20, paddingTop: 15, marginHorizontal:5, borderTopWidth: 1, borderColor: '#e0e0e0', }, adminActionTitle: { textAlign: 'center', fontSize: 13, color: '#777', marginBottom: 12, fontStyle: 'italic', fontWeight:'500' },
});
export default InternshipDetailScreen;