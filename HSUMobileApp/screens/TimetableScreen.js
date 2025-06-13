// screens/TimetableScreen.js
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {ScrollView,ActivityIndicator,Alert,TouchableOpacity,View,Text,StyleSheet,RefreshControl} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';

// --- Cấu hình Tiếng Việt ---
LocaleConfig.locales['vi'] = { monthNames: ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'], monthNamesShort: ['Th.1','Th.2','Th.3','Th.4','Th.5','Th.6','Th.7','Th.8','Th.9','Th.10','Th.11','Th.12'], dayNames: ['Chủ Nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'], dayNamesShort: ['CN','T2','T3','T4','T5','T6','T7'], today: 'Hôm nay' };
LocaleConfig.defaultLocale = 'vi';

// --- API BASE URL ---
const API_BASE_URL = 'http://10.101.39.47:5000'; // <-- Sửa lại IP/URL backend đúng

// --- Lấy ngày hôm nay ---
const getTodayDateString = () => new Date().toISOString().split('T')[0];

// --- Hàm xác định Học kỳ/Năm (Ví dụ) ---
const getSemesterInfo = (date) => {
    if (!(date instanceof Date) || isNaN(date.getTime())) { return 'Thời khóa biểu'; }
    const month = date.getMonth() + 1; const year = date.getFullYear();
    let semester = 'Ngoài học kỳ'; let academicYear = `${year}-${year + 1}`;
    if (month >= 9 && month <= 12) { semester = 'Học kỳ 1'; academicYear = `${year}-${year + 1}`; }
    else if (month >= 1 && month <= 2) { semester = 'Học kỳ Tết'; academicYear = `${year - 1}-${year}`; }
    else if (month >= 3 && month <= 6) { semester = 'Học kỳ 2'; academicYear = `${year - 1}-${year}`; }
    else if (month >= 7 && month <= 9) { semester = 'Học kỳ Hè'; academicYear = `${year - 1}-${year}`; }
    return `${semester} (${academicYear})`;
};

// --- Component con để hiển thị một dòng chi tiết ---
const DetailRow = React.memo(({ icon, label, value, valueStyle }) => (
    <View style={styles.detailRow}>
        <FontAwesome5 name={icon} size={14} color="#555" style={styles.detailIcon} />
        <Text style={styles.detailLabel}>{label}:</Text>
        <Text style={[styles.detailValue, valueStyle]} numberOfLines={2}>{value ?? 'N/A'}</Text>
    </View>
));

// === COMPONENT CHÍNH: TimetableScreen ===================
const TimetableScreen = () => {
    const navigation = useNavigation();
    // --- State Variables ---
    const [allTimetableEntries, setAllTimetableEntries] = useState([]);
    const [selectedDate, setSelectedDate] = useState(getTodayDateString());
    const [markedDates, setMarkedDates] = useState({});
    const [currentMonthDate, setCurrentMonthDate] = useState(() => new Date(getTodayDateString() + 'T00:00:00Z')); // Khởi tạo an toàn
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    // --- Refs ---
    const baseMarkedDatesRef = useRef({});
    const isFetchingRef = useRef(false);

    // --- Cập nhật Header Title ---
    useEffect(() => {
        if (currentMonthDate instanceof Date && !isNaN(currentMonthDate.getTime())) {
            const semesterInfo = getSemesterInfo(currentMonthDate);
            navigation.setOptions({ title: semesterInfo || 'Thời khóa biểu' });
        } else {
             navigation.setOptions({ title: 'Thời khóa biểu' });
        }
    }, [currentMonthDate, navigation]);

    // --- Hàm tạo đánh dấu CƠ BẢN (chấm xanh) ---
    const generateBaseMarkedDates = useCallback((timetableData) => {
        console.log("[TimetableScreen] Generating BASE marked dates (blue dots)...");
        const markers = {};
        if (!Array.isArray(timetableData)) { console.error("[TimetableScreen] generateBaseMarkedDates: Input data is not an array!"); return {}; }
        timetableData.forEach((item, index) => {
            const dateStr = item?.date;
            if (dateStr && typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                markers[dateStr] = { marked: true, dotColor: '#0056b3', activeOpacity: 0.7 };
            } else { console.warn(`[TimetableScreen] Item index ${index} (ID: ${item?._id}) has invalid/missing 'date' field:`, dateStr); }
        });
        baseMarkedDatesRef.current = markers;
        console.log(`[TimetableScreen] Base marked dates generated for ${Object.keys(markers).length} dates.`);
        return markers;
    }, []);

    // --- Hàm kết hợp đánh dấu cơ bản và selection ---
    const combineMarkersWithSelection = useCallback((baseMarkers, currentSelected) => {
        console.log(`[TimetableScreen] Combining markers. Base keys: ${Object.keys(baseMarkers || {}).length}, Selected: ${currentSelected}`);
        if (!currentSelected || typeof currentSelected !== 'string' || !currentSelected.match(/^\d{4}-\d{2}-\d{2}$/)) { return { ...(baseMarkers || {}) }; }
        const finalMarkers = { ...(baseMarkers || {}) };
        const selectedStyle = { selected: true, selectedColor: '#007bff', selectedTextColor: '#ffffff' };
        if (finalMarkers[currentSelected]) {
            finalMarkers[currentSelected] = { ...finalMarkers[currentSelected], ...selectedStyle };
        } else {
            finalMarkers[currentSelected] = selectedStyle;
        }
        return finalMarkers;
    }, []);

    // --- Hàm Fetch dữ liệu LỊCH HỌC ---
    const fetchMyTimetable = useCallback(async (isRefreshing = false) => {
        if (isFetchingRef.current && !isRefreshing) { if(isRefreshing) setRefreshing(false); return; }
        isFetchingRef.current = true;
        if (!isRefreshing) setIsLoading(true);
        setError(null);
        console.log('[TimetableScreen] Starting fetch my timetable...');
        let token;
        try {
            token = await AsyncStorage.getItem('userToken');
            if (!token) throw new Error('Token không tồn tại. Vui lòng đăng nhập lại.');
            const apiUrl = `${API_BASE_URL}/api/timetable/my`; // <-- API Lịch Học
            const response = await fetch(apiUrl, { method: 'GET', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
            const responseBody = await response.text();
            let result = JSON.parse(responseBody);
            console.log(`[TimetableScreen] API Status: ${response.status}`);

            if (response.ok && result.success && Array.isArray(result.data)) {
                const fetchedData = result.data;
                console.log('[TimetableScreen] Fetched Data:', fetchedData.length);
                setAllTimetableEntries(fetchedData);
                const baseMarkers = generateBaseMarkedDates(fetchedData);
                // Tạo marked dates ban đầu dựa trên selectedDate hiện tại
                const currentSelectedDate = selectedDate || getTodayDateString(); // Đảm bảo selectedDate hợp lệ
                const initialMarked = combineMarkersWithSelection(baseMarkers, currentSelectedDate);
                setMarkedDates(initialMarked);
            } else { throw new Error(result.message || `Lỗi ${response.status}`); }
        } catch (err) {
            console.error('[TimetableScreen] Error in fetchMyTimetable:', err);
            setError(err.message); setAllTimetableEntries([]); setMarkedDates({}); baseMarkedDatesRef.current={};
            if (String(err.message).includes('Token')) { Alert.alert("Phiên hết hạn", "Vui lòng đăng nhập lại.", [{ text: "OK", onPress: () => navigation.replace('Login') }]); }
        } finally {
            if (!isRefreshing) setIsLoading(false);
            setRefreshing(false);
            isFetchingRef.current = false;
        }
    }, [navigation, generateBaseMarkedDates, combineMarkersWithSelection, selectedDate]);

    // --- Fetch lần đầu khi mount ---
     useEffect(() => {
         console.log("[TimetableScreen] Component mounted, fetching initial data.");
         fetchMyTimetable();
     }, []); // Chỉ chạy 1 lần

    // --- Xử lý khi chọn ngày ---
    const handleDayPress = useCallback((day) => {
        if (!day || typeof day.dateString !== 'string' || !day.dateString.match(/^\d{4}-\d{2}-\d{2}$/)) { console.error("Invalid day obj from onDayPress:", day); return; }
        const newSelectedDate = day.dateString;
        if (newSelectedDate === selectedDate) return;
        setSelectedDate(newSelectedDate);
        const updatedMarked = combineMarkersWithSelection(baseMarkedDatesRef.current, newSelectedDate);
        setMarkedDates(updatedMarked);
    }, [selectedDate, combineMarkersWithSelection]);

    // --- Xử lý khi chuyển tháng ---
    const handleMonthChange = useCallback((month) => {
        if (!month || typeof month.timestamp !== 'number') { console.error("Invalid month obj from onMonthChange:", month); return; }
        console.log('[TimetableScreen] Month changed to', month.dateString);
        const newMonthDate = new Date(month.timestamp);
        if (!isNaN(newMonthDate.getTime())) {
            setCurrentMonthDate(newMonthDate);
        } else { console.error("Invalid date from month timestamp:", month.timestamp); }
        // Không fetch lại dữ liệu khi chuyển tháng ở phiên bản này
    }, [navigation]);

    // --- Kéo để làm mới ---
    const onRefresh = useCallback(() => {
        console.log('[TimetableScreen] Refreshing...');
        setRefreshing(true);
        fetchMyTimetable(true); // Gọi lại fetch chính với cờ refreshing
    }, [fetchMyTimetable]);

    // --- Lọc chi tiết bằng useMemo ---
    const entriesForSelectedDate = useMemo(() => {
        if (!selectedDate || typeof selectedDate !== 'string') return []; // Kiểm tra selectedDate
        return allTimetableEntries.filter(item => item?.date === selectedDate);
    }, [allTimetableEntries, selectedDate]);

    // --- Render chi tiết LỊCH HỌC ---
    const renderSelectedDayEntries = () => {
        if (entriesForSelectedDate.length === 0) {
            return !isLoading && !refreshing ? <Text style={styles.noEntriesText}>Không có lịch học vào ngày này.</Text> : null;
        }
        try {
            return entriesForSelectedDate.map((item) => (
                <View key={item._id ? item._id.toString() : Math.random().toString()} style={styles.timetableCard}>
                    <View style={styles.cardRow}>
                        <FontAwesome5 name="book-open" size={14} color="#0056b3" style={styles.icon} />
                        <Text style={styles.courseName} numberOfLines={2}>{item.courseName || 'N/A'}</Text>
                        {item.courseCode && <Text style={styles.courseCode}> ({item.courseCode})</Text>}
                    </View>
                    <View style={styles.detailsContainer}>
                         <DetailRow icon="clock" label="Giờ học" value={`${item.startTime || '?'} - ${item.endTime || '?'}`} />
                         <DetailRow icon="map-marker-alt" label="Phòng" value={item.room || 'N/A'} />
                         <DetailRow icon="user-tie" label="Giảng viên" value={item.instructor || 'N/A'} />
                     </View>
                </View>
            ));
        } catch (renderError) {
             console.error("[RenderDetails][Timetable] Error:", renderError);
             return <Text style={styles.errorText}>Lỗi hiển thị chi tiết lịch học.</Text>;
        }
    };

    // --- Giao diện chính ---
    return (
        <SafeAreaView style={styles.safeArea}>
            {isLoading && allTimetableEntries.length === 0 ? (
                <View style={styles.centeredMessage}><ActivityIndicator size="large" color="#002366" /><Text style={styles.loadingText}>Đang tải...</Text></View>
            ) : error && !isLoading ? (
                <View style={styles.centeredMessage}><FontAwesome5 name="exclamation-circle" size={40} color="#dc3545" /><Text style={styles.errorText}>Không thể tải dữ liệu</Text><Text style={styles.errorDetailText}>{error?.message || error}</Text><TouchableOpacity style={styles.retryButton} onPress={() => fetchMyTimetable()}><Text style={styles.retryButtonText}>Thử lại</Text></TouchableOpacity></View>
            ) : (
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollViewContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#002366"]} tintColor={"#002366"} />}
                    showsVerticalScrollIndicator={false}
                >
                    <Calendar
                        // --- Props cho Calendar ---
                        initialDate={selectedDate} // Ngày ban đầu hiển thị
                        markedDates={markedDates}   // Dữ liệu đánh dấu (chấm xanh + selection)
                        onDayPress={handleDayPress} // Xử lý chọn ngày
                        onMonthChange={handleMonthChange} // Xử lý chuyển tháng
                        monthFormat={'MM / yyyy'}   // Định dạng tiêu đề tháng
                        firstDay={1}               // Tuần bắt đầu từ T2
                        theme={{                    // Giao diện
                             calendarBackground: '#ffffff', textSectionTitleColor: '#555',
                             selectedDayBackgroundColor: '#007bff', selectedDayTextColor: '#ffffff',
                             todayTextColor: '#007bff', dayTextColor: '#2d4150',
                             textDisabledColor: '#d9e1e8', dotColor: '#0056b3', // <-- Màu chấm
                             selectedDotColor: '#ffffff', arrowColor: '#0056b3',
                             monthTextColor: '#002366', indicatorColor: 'blue',
                             textDayFontWeight: '400', textMonthFontWeight: 'bold',
                             textDayHeaderFontWeight: '500', textDayFontSize: 15,
                             textMonthFontSize: 16, textDayHeaderFontSize: 13
                         }}
                        style={styles.calendar}
                        pastScrollRange={12}       // Cho phép cuộn 12 tháng về trước
                        futureScrollRange={12}     // Cho phép cuộn 12 tháng tới
                    />
                    {/* --- Phần hiển thị chi tiết --- */}
                    <View style={styles.selectedDayContainer}>
                         {refreshing ? (
                             <ActivityIndicator size="small" color="#002366" style={{marginTop: 20}} />
                         ) : (
                            renderSelectedDayEntries() // Render chi tiết hoặc thông báo rỗng
                         )}
                    </View>
                </ScrollView>
            )}
        </SafeAreaView>
    );
};

// --- StyleSheet ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f8f9fa' },
    centeredMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 25 },
    loadingText: { marginTop: 12, fontSize: 16, color: '#6c757d' },
    errorText: { marginTop: 15, fontSize: 17, fontWeight: '600', color: '#e63946', textAlign: 'center' },
    errorDetailText: { marginTop: 5, fontSize: 14, color: '#6c757d', textAlign: 'center', marginBottom: 20 },
    retryButton: { backgroundColor: '#1d3557', paddingHorizontal: 25, paddingVertical: 10, borderRadius: 8, elevation: 2, shadowOpacity: 0.1 },
    retryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    scrollView: { flex: 1 },
    scrollViewContent: { paddingBottom: 20 },
    calendar: { marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
    selectedDayContainer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 40, minHeight: 150 },
    timetableCard: {
        backgroundColor: '#ffffff', borderRadius: 10, marginBottom: 14, paddingVertical: 12, paddingHorizontal:15,
        shadowColor: "#bdbdbd", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1,
        shadowRadius: 4, elevation: 3, borderWidth: 1, borderColor: '#f0f0f0',
    },
    cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    icon: { width: 20, textAlign: 'center', marginRight: 12, color: '#888' },
    courseName: { fontSize: 16, fontWeight: 'bold', color: '#003366', flexShrink: 1, marginBottom: 5 },
    courseCode: { fontSize: 12, color: '#888', marginLeft: 4, fontStyle:'italic' },
    detailsContainer: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f5f5f5' },
    detailRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
    detailIcon: { width: 20, textAlign: 'center', marginRight: 10, color: '#666', marginTop: 2 },
    detailLabel: { fontSize: 14, color: '#777', width: 80, fontWeight:'500' },
    detailValue: { fontSize: 14, color: '#333', flex: 1, fontWeight: '500', lineHeight: 20},
    noEntriesText:{ textAlign: 'center', marginTop: 30, marginBottom: 20, color: '#999', fontSize: 15, fontStyle: 'italic' }
});

export default TimetableScreen;