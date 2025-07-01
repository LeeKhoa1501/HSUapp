// HSUMobileApp/screens/InternshipListScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { format, parseISO } from 'date-fns';
import vi from 'date-fns/locale/vi';
import { API_BASE_URL } from '@env';

const BASE_URL = API_BASE_URL;

const getInternshipTypeLabel = (value) => {
    const types = { 'nhan_thuc': 'TT. Nhận thức', 'kien_tap': 'Kiến tập', 'tot_nghiep': 'TT. Tốt nghiệp', 'du_an_doanh_nghiep': 'D.án Doanh nghiệp', 'other': 'Khác' };
    return types[value] || String(value || 'Chưa rõ');
};
const getStatusStyle = (status) => {
    const s = String(status || 'Không rõ').toLowerCase();
    if (s === 'pending' || s === 'pending_approval') return { label: 'Chờ duyệt', badgeColor: '#fff3cd', textColor: '#856404' };
    if (s === 'approved') return { label: 'Đã duyệt', badgeColor: '#d1e7dd', textColor: '#0f5132' };
    if (s === 'rejected') return { label: 'Đã từ chối', badgeColor: '#f8d7da', textColor: '#721c24' };
    if (s === 'inprogress' || s === 'in_progress') return { label: 'Đang TT', badgeColor: '#cce5ff', textColor: '#004085' };
    if (s === 'completed') return { label: 'Hoàn thành', badgeColor: '#d4edda', textColor: '#155724' };
    if (s === 'cancelled') return { label: 'Đã hủy', badgeColor: '#e9ecef', textColor: '#495057' };
    return { label: s.charAt(0).toUpperCase() + s.slice(1), badgeColor: '#6c757d', textColor: '#fff' };
};
const formatDateSimple = (dateString) => {
    if (!dateString) return 'Chưa rõ';
    try { return format(parseISO(dateString), 'dd/MM/yy', { locale: vi }); }
    catch (e) { try { return format(new Date(dateString), 'dd/MM/yy', { locale: vi }); } catch (ex) { return 'Ngày không hợp lệ'; } }
};

const InternshipItem = React.memo(({ item, onPress }) => {
    const { label: statusLabel, badgeColor, textColor } = getStatusStyle(item.status);
    return (
        <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.itemHeader}>
                <Text style={styles.itemRequestCode} numberOfLines={1}>
                    {item.requestCode || 'Chưa có mã'}
                </Text>
                <View style={[styles.itemStatusBadge, { backgroundColor: badgeColor }]}>
                    <Text style={[styles.itemStatusText, { color: textColor }]}>{statusLabel}</Text>
                </View>
            </View>
            <View style={styles.itemRow}>
                <FontAwesome5 name="briefcase" size={13} color="#5f6368" style={styles.itemIcon}/>
                <Text style={styles.itemTextValue} numberOfLines={1}> {getInternshipTypeLabel(item.internshipType)}</Text>
            </View>
            <View style={styles.itemRow}>
                <FontAwesome5 name="building" size={13} color="#5f6368" style={styles.itemIcon}/>
                <Text style={styles.itemTextValue} numberOfLines={1}> {item.companyNameOther || item.companyId?.name || 'Chưa rõ công ty'}</Text>
            </View>
            <View style={styles.itemRow}>
                <FontAwesome5 name="calendar-alt" size={13} color="#5f6368" style={styles.itemIcon}/>
                <Text style={styles.itemTextValue}> Ngày gửi: {formatDateSimple(item.requestDate || item.createdAt)}</Text>
            </View>
            <View style={styles.itemArrowContainer}>
                <FontAwesome5 name="chevron-right" size={16} color="#b0bec5" />
            </View>
        </TouchableOpacity>
    );
});

const CustomPickerModal = React.memo(({ isVisible, onClose, options, selectedValue, onSelect, title }) => {
    return (
        <Modal
            transparent={true}
            visible={isVisible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
                <TouchableOpacity style={styles.modalContent} activeOpacity={1}>
                    <Text style={styles.modalTitle}>{title}</Text>
                    <FlatList
                        data={options}
                        keyExtractor={(item) => item.value}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[styles.modalItem, item.value === selectedValue && styles.modalItemSelected]}
                                onPress={() => onSelect(item.value)}
                            >
                                <Text style={[styles.modalItemText, item.value === selectedValue && styles.modalItemSelectedText]}>
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        )}
                        ItemSeparatorComponent={() => <View style={styles.modalSeparator} />}
                    />
                    <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
                        <Text style={styles.modalCloseButtonText}>Đóng</Text>
                    </TouchableOpacity>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
});

const InternshipListScreen = () => {
    const navigation = useNavigation();
    const [requests, setRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(`${currentYear}-${currentYear + 1}`);
    const [selectedSemester, setSelectedSemester] = useState('all');

    const [isYearModalVisible, setYearModalVisible] = useState(false);
    const [isSemesterModalVisible, setSemesterModalVisible] = useState(false);

    const yearOptions = [
        { label: `Năm học ${currentYear + 1}-${currentYear + 2}`, value: `${currentYear + 1}-${currentYear + 2}` },
        { label: `Năm học ${currentYear}-${currentYear + 1}`, value: `${currentYear}-${currentYear + 1}` },
        { label: `Năm học ${currentYear - 1}-${currentYear}`, value: `${currentYear - 1}-${currentYear}` },
        { label: 'Tất cả năm học', value: 'all' },
    ];
    const semesterOptions = [
        { label: 'Tất cả học kỳ', value: 'all' },
        { label: 'Học kỳ 1', value: 'HK1' },
        { label: 'Học kỳ tết', value: 'HK_TET' }, // <<< BỔ SUNG DÒNG NÀY
        { label: 'Học kỳ 2', value: 'HK2' },
        { label: 'Học kỳ Hè', value: 'HK3' },
    ];
    
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);
    
    const SEMESTER_CODE_MAP = {
        HK1: () => `${String(currentYear).slice(-2)}${String(currentYear+1).slice(-2)}1`,
        HK2: () => `${String(currentYear).slice(-2)}${String(currentYear+1).slice(-2)}2`,
        HK_TET: () => `${String(currentYear).slice(-2)}${String(currentYear+1).slice(-2)}4`,
        HK3: () => `${String(currentYear).slice(-2)}${String(currentYear+1).slice(-2)}3`,
    };

    const fetchMyInternshipRequests = useCallback(async (isRefreshing = false) => { 
        if (!isMountedRef.current) return;
        if (!isRefreshing) setIsLoading(true);
        setError(null);
        try {
            const token = await AsyncStorage.getItem('userToken');
            if (!token) { throw new Error("Token không hợp lệ. Vui lòng đăng nhập lại."); }
            
            let semesterParam = selectedSemester;
            if (selectedSemester !== 'all') {
                const realCode = SEMESTER_CODE_MAP[selectedSemester]?.();
                semesterParam = realCode || selectedSemester;
            }
            const query = `?academicYear=${selectedYear}&semester=${semesterParam}`;
            const response = await fetch(`${BASE_URL}/api/internships/my${query}`, {
                 headers: { Authorization: `Bearer ${token}` }
            });

            if (!isMountedRef.current) return;
            const responseText = await response.text();
            
            let result;
            try { result = JSON.parse(responseText); } 
            catch (e) { throw new Error(`Lỗi parse JSON từ server. (Status: ${response.status})`); }

            if (response.ok && result.success && Array.isArray(result.data)) {
                if (isMountedRef.current) setRequests(result.data);
            } else { throw new Error(result.message || `Lỗi tải danh sách (${response.status})`); }
        } catch (err) {
            if (isMountedRef.current) {
                setError(err.message);
                setRequests([]);
                if (String(err.message).toLowerCase().includes('token') || String(err.message).includes('401')) {
                    Alert.alert("Phiên làm việc hết hạn", "Vui lòng đăng nhập lại.", [{ text: "OK", onPress: () => navigation.replace('Login') }], { cancelable: false });
                }
            }
        } finally {
            if (isMountedRef.current) {
                if (!isRefreshing) setIsLoading(false);
                setRefreshing(false);
            }
        }
    }, [navigation, selectedYear, selectedSemester]);

    useFocusEffect(useCallback(() => {
        fetchMyInternshipRequests();
    }, [fetchMyInternshipRequests]));

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        fetchMyInternshipRequests(true);
    }, [fetchMyInternshipRequests]);
    
    const handleViewDetail = useCallback((item) => {
        if (item && item._id) {
            navigation.navigate('InternshipDetailScreen', { requestId: item._id });
        } else { Alert.alert("Lỗi", "Không thể xem chi tiết do thiếu ID đơn."); }
    }, [navigation]);

    const renderEmptyList = () => (
        <View style={styles.centeredMessageContainer}>
            <FontAwesome5 name="folder-open" size={60} color="#ced4da" style={{marginBottom: 20}}/>
            <Text style={styles.emptyListText}>Không có đơn thực tập nào.</Text>
            <Text style={styles.emptyListHint}>Nhấn nút "+" để tạo đơn mới.</Text>
        </View>
    );

    const renderListError = () => (
        <View style={styles.centeredMessageContainer}>
            <FontAwesome5 name="exclamation-circle" size={60} color="#e74c3c" style={{marginBottom: 20}}/>
            <Text style={styles.errorTitleText}>Không thể tải dữ liệu</Text>
            {error && <Text style={styles.errorDetailText}>{String(error)}</Text>}
            <TouchableOpacity style={styles.retryLoadButton} onPress={() => fetchMyInternshipRequests(false)}>
                <Text style={styles.retryLoadButtonText}>Thử lại</Text>
            </TouchableOpacity>
        </View>
    );

    if (isLoading && requests.length === 0) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.centeredMessageContainer}>
                    <ActivityIndicator size="large" color="#002366" />
                </View>
            </SafeAreaView>
        );
    }

    const selectedYearLabel = yearOptions.find(opt => opt.value === selectedYear)?.label;
    const selectedSemesterLabel = semesterOptions.find(opt => opt.value === selectedSemester)?.label;

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.filterContainer}>
                <TouchableOpacity style={styles.pickerTrigger} onPress={() => setYearModalVisible(true)}>
                    <Text style={styles.pickerTriggerText} numberOfLines={1}>{selectedYearLabel}</Text>
                    <FontAwesome5 name="chevron-down" size={12} color="#495057" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.pickerTrigger} onPress={() => setSemesterModalVisible(true)}>
                    <Text style={styles.pickerTriggerText} numberOfLines={1}>{selectedSemesterLabel}</Text>
                    <FontAwesome5 name="chevron-down" size={12} color="#495057" />
                </TouchableOpacity>
            </View>

            <CustomPickerModal
                isVisible={isYearModalVisible}
                onClose={() => setYearModalVisible(false)}
                options={yearOptions}
                selectedValue={selectedYear}
                onSelect={(value) => {
                    setSelectedYear(value);
                    setYearModalVisible(false);
                }}
                title="Chọn năm học"
            />
            <CustomPickerModal
                isVisible={isSemesterModalVisible}
                onClose={() => setSemesterModalVisible(false)}
                options={semesterOptions}
                selectedValue={selectedSemester}
                onSelect={(value) => {
                    setSelectedSemester(value);
                    setSemesterModalVisible(false);
                }}
                title="Chọn học kỳ"
            />

            {error && requests.length === 0 && !isLoading ? renderListError() : (
                <FlatList
                    data={requests}
                    renderItem={({ item }) => <InternshipItem item={item} onPress={() => handleViewDetail(item)} />}
                    keyExtractor={(item) => item._id || Math.random().toString()}
                    contentContainerStyle={requests.length === 0 ? styles.centeredMessageContainer : styles.listContainer}
                    ListEmptyComponent={!isLoading ? renderEmptyList : null}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={["#002366"]} tintColor={"#002366"} />}
                />
            )}
            
            <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('InternshipFormScreen')}>
                <FontAwesome5 name="plus" size={20} color="#fff" />
            </TouchableOpacity>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f4f6f8' },
    filterContainer: {
        flexDirection: 'row',
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: '#f4f6f8',
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef'
    },
    pickerTrigger: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        borderRadius: 20,
        paddingVertical: 10,
        paddingHorizontal: 15,
        marginHorizontal: 5,
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 2,
        borderWidth: 1,
        borderColor: '#dee2e6'
    },
    pickerTriggerText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#495057',
        marginRight: 8,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingTop: 20,
        paddingBottom: 10,
        paddingHorizontal: 15,
        width: '85%',
        maxHeight: '60%',
        elevation: 5,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
        color: '#003366',
    },
    modalItem: {
        paddingVertical: 14,
        paddingHorizontal: 10,
    },
    modalItemSelected: {
        backgroundColor: '#e7f0ff',
        borderRadius: 8,
    },
    modalItemText: {
        fontSize: 16,
        color: '#333',
        textAlign: 'center',
    },
    modalItemSelectedText: {
        fontWeight: 'bold',
        color: '#0056b3',
    },
    modalSeparator: {
        height: 1,
        backgroundColor: '#f1f3f5',
    },
    modalCloseButton: {
        marginTop: 15,
        paddingVertical: 10,
        alignItems: 'center',
    },
    modalCloseButtonText: {
        fontSize: 16,
        color: '#007bff',
        fontWeight: 'bold',
    },
    listContainer: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 80 },
    itemCard: { backgroundColor: '#ffffff', padding: 16, marginBottom: 12, borderRadius: 10, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2.5, borderWidth: 1, borderColor: '#f1f3f5' },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    itemRequestCode: { fontSize: 15, fontWeight: 'bold', color: '#003974', flexShrink: 1, marginRight: 8 },
    itemStatusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },
    itemStatusText: { fontSize: 11, fontWeight: '600' },
    itemRow: { flexDirection:'row', alignItems:'center', marginBottom: 7 },
    itemIcon: { width: 18, textAlign: 'center', marginRight:8, color:'#5f6368' },
    itemTextValue: { fontSize: 13, color: '#3c4043', flex: 1 },
    itemArrowContainer: { position: 'absolute', right: 16, top: '50%', transform: [{ translateY: -8 }] },
    centeredMessageContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f4f6f8' },
    emptyListText: { fontSize: 17, color: '#495057', textAlign: 'center', marginBottom: 8, fontWeight:'500' },
    emptyListHint: { fontSize: 14, color: '#6c757d', textAlign: 'center' },
    errorTitleText: { fontSize: 18, fontWeight: 'bold', color: '#c0392b', textAlign: 'center', marginBottom: 10 },
    errorDetailText: { fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 20, lineHeight:20 },
    retryLoadButton: { backgroundColor: '#0056b3', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8 },
    retryLoadButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    fab: { position: 'absolute', margin: 16, right: 15, bottom: 25, backgroundColor: '#0056b3', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, }
});

export default InternshipListScreen;