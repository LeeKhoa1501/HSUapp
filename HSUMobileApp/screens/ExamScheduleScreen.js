// screens/ExamScheduleScreen.js
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
const getTodayDateString = () => {
    try { return new Date().toISOString().split('T')[0]; }
    catch (e) { console.error("Error getting today's date string:", e); const d=new Date(); return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`; }
};

// --- Hàm xác định Học kỳ/Năm (Ví dụ) ---
const getSemesterInfo = (date) => {
    if (!(date instanceof Date) || isNaN(date.getTime())) { return 'Lịch Thi'; }
    const month = date.getMonth() + 1; const year = date.getFullYear(); let semester = 'Ngoài học kỳ'; let academicYear = `${year}-${year + 1}`;
    if (month >= 9 && month <= 12) { semester = 'Học kỳ 1'; academicYear = `${year}-${year + 1}`; }
    else if (month >= 1 && month <= 1) { semester = 'Học kỳ Tết'; academicYear = `${year - 1}-${year}`; }
    else if (month >= 2 && month <= 5) { semester = 'Học kỳ 2'; academicYear = `${year - 1}-${year}`; }
    else if (month >= 6 && month <= 8) { semester = 'Học kỳ Hè'; academicYear = `${year - 1}-${year}`; }
    return `${semester} (${academicYear})`;
};

// --- Component con DetailRow ---
const DetailRow = React.memo(({ icon, label, value, valueStyle }) => (
    <View style={styles.detailRow}>
        <FontAwesome5 name={icon} size={14} color="#555" style={styles.detailIcon} />
        <Text style={styles.detailLabel}>{label}:</Text>
        <Text style={[styles.detailValue, valueStyle]} numberOfLines={2}>{value ?? 'N/A'}</Text>
    </View>
));

// === COMPONENT CHÍNH: ExamScheduleScreen ================
const ExamScheduleScreen = () => {
    const navigation = useNavigation();
    // --- State Variables ---
    const [allExamEntries, setAllExamEntries] = useState([]);
    // Khởi tạo selectedDate trước
    const [selectedDate, setSelectedDate] = useState(getTodayDateString());
    const [markedDates, setMarkedDates] = useState({});
    // --- SỬA LỖI Ở ĐÂY: Khởi tạo currentMonthDate DÙNG getTodayDateString() ---
    const [currentMonthDate, setCurrentMonthDate] = useState(() => new Date(getTodayDateString() + 'T00:00:00Z')); // <-- Sửa lại, không dùng selectedDate ở đây
    // ----------------------------------------------------------------------
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
            navigation.setOptions({ title: semesterInfo || 'Lịch Thi' });
        } else { navigation.setOptions({ title: 'Lịch Thi' }); }
    }, [currentMonthDate, navigation]);

    // --- Hàm tạo đánh dấu CƠ BẢN (tô nền đỏ nhạt) ---
    const generateBaseMarkedDates = useCallback((examData) => {
        const markers = {};
        if (!Array.isArray(examData)) return {};
        examData.forEach(item => {
            const dateStr = item?.date;
            if (dateStr && typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                markers[dateStr] = { startingDay: true, endingDay: true, color: '#ffebee', textColor: '#c62828', marked: true };
            }
        });
        baseMarkedDatesRef.current = markers;
        return markers;
    }, []);

    // --- Hàm kết hợp đánh dấu cơ bản và selection ---
    const combineMarkersWithSelection = useCallback((baseMarkers, currentSelected) => {
        if (!currentSelected || typeof currentSelected !== 'string' || !currentSelected.match(/^\d{4}-\d{2}-\d{2}$/)) { return { ...(baseMarkers || {}) }; }
        const finalMarkers = { ...(baseMarkers || {}) };
        const selectedStyle = { selected: true, selectedColor: '#007bff', textColor: '#ffffff' };
        if (finalMarkers[currentSelected]) {
            finalMarkers[currentSelected] = { ...finalMarkers[currentSelected], ...selectedStyle, color: selectedStyle.selectedColor, textColor: selectedStyle.selectedTextColor };
        } else {
            finalMarkers[currentSelected] = selectedStyle;
        }
        return finalMarkers;
    }, []);

    // --- Hàm Fetch dữ liệu LỊCH THI ---
    const fetchMyExams = useCallback(async (isRefreshing = false) => {
        if (isFetchingRef.current && !isRefreshing) { if(isRefreshing) setRefreshing(false); return; }
        isFetchingRef.current = true;
        if (!isRefreshing) setIsLoading(true);
        setError(null);
        let token;
        try {
            token = await AsyncStorage.getItem('userToken');
            if (!token) throw new Error('Token không tồn tại...');
            const apiUrl = `${API_BASE_URL}/api/exams/my`;
            const response = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
            let result = JSON.parse(await response.text());

            if (response.ok && result.success && Array.isArray(result.data)) {
                const fetchedData = result.data;
                setAllExamEntries(fetchedData);
                const baseMarkers = generateBaseMarkedDates(fetchedData);
                const currentSelectedDate = selectedDate || getTodayDateString(); // Lấy ngày đang chọn (hoặc ngày hôm nay nếu có lỗi)
                const initialMarked = combineMarkersWithSelection(baseMarkers, currentSelectedDate);
                setMarkedDates(initialMarked);
            } else { throw new Error(result.message || `Lỗi ${response.status}`); }
        } catch (err) { setError(err.message); setAllExamEntries([]); setMarkedDates({}); baseMarkedDatesRef.current={}; if (String(err.message).includes('Token')) { Alert.alert("Phiên hết hạn", "Vui lòng đăng nhập lại.", [{ text: "OK", onPress: () => navigation.replace('Login') }]); }}
        finally { if (!isRefreshing) setIsLoading(false); setRefreshing(false); isFetchingRef.current = false; }
    }, [navigation, generateBaseMarkedDates, combineMarkersWithSelection, selectedDate]);

    // --- Fetch lần đầu ---
     useEffect(() => { fetchMyExams(); }, []);

    // --- Xử lý khi chọn ngày ---
    const handleDayPress = useCallback((day) => {
        if (!day || typeof day.dateString !== 'string' || !day.dateString.match(/^\d{4}-\d{2}-\d{2}$/)) return;
        const newSelectedDate = day.dateString;
        if (newSelectedDate === selectedDate) return;
        setSelectedDate(newSelectedDate);
        const updatedMarked = combineMarkersWithSelection(baseMarkedDatesRef.current, newSelectedDate);
        setMarkedDates(updatedMarked);
    }, [selectedDate, combineMarkersWithSelection]);

    // --- Xử lý khi chuyển tháng ---
    const handleMonthChange = useCallback((month) => {
        if (!month || typeof month.timestamp !== 'number') { return; }
        const newMonthDate = new Date(month.timestamp);
        if (!isNaN(newMonthDate.getTime())) {
             setCurrentMonthDate(newMonthDate); // <-- Dùng hàm setter đúng
        } else { console.error("Invalid date from month timestamp:", month.timestamp); }
        // Không fetch lại khi chuyển tháng
    }, [navigation]);

    // --- Kéo để làm mới ---
    const onRefresh = useCallback(() => { fetchMyExams(true); }, [fetchMyExams]);

    // --- Lọc chi tiết bằng useMemo ---
    const entriesForSelectedDate = useMemo(() => {
        if (!selectedDate || typeof selectedDate !== 'string') return [];
        return allExamEntries.filter(item => item?.date === selectedDate);
    }, [allExamEntries, selectedDate]);

    // --- Render chi tiết LỊCH THI ---
    const renderSelectedDayExams = () => {
        if (entriesForSelectedDate.length === 0) { return !isLoading && !refreshing ? <Text style={styles.noEntriesText}>Không có lịch thi vào ngày này.</Text> : null; }
        try {
            return entriesForSelectedDate.map((item) => {
                 const displayDate = item.date ? new Date(item.date + 'T00:00:00Z').toLocaleDateString('vi-VN', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A';
                 const displayLocation = `${item.room || 'N/A'}${item.locationName ? ` - ${item.locationName}` : ''}`;
                 return (
                    <View key={item._id} style={styles.examCard}>
                        <View style={styles.redHeader}><Text style={styles.redHeaderText}>{item.courseCode ? `${item.courseCode} `: ''}</Text></View>
                        <View style={styles.greenHeader}><Text style={styles.greenHeaderText} numberOfLines={1}>{item.courseName || 'N/A'}</Text></View>
                        <View style={styles.blueContent}>
                            <View style={styles.contentRow}><Text style={styles.contentLabel}>Ngày thi</Text><Text style={styles.contentValue}>{displayDate}</Text></View>
                            <View style={styles.contentRow}><Text style={styles.contentLabel}>Giờ thi</Text><Text style={styles.contentValue}>{item.startTime || 'N/A'}</Text></View>
                            <View style={styles.contentRow}><Text style={styles.contentLabel}>Thời gian</Text><Text style={styles.contentValue}>{typeof item.durationMinutes === 'number' ? `${item.durationMinutes}` : 'N/A'}</Text></View>
                            {/* <View style={styles.contentRow}><Text style={styles.contentLabel}>Lớp</Text><Text style={styles.contentValue}>{item.classId || 'N/A'}</Text></View> */}
                            <View style={styles.contentRow}><Text style={styles.contentLabel}>Phòng</Text><Text style={styles.contentValue} numberOfLines={1}>{displayLocation}</Text></View>
                        </View>
                    </View>
                 );
            });
        } catch (renderError) { console.error("[RenderDetails][ExamScreen] Error:", renderError); return <Text style={styles.errorText}>Lỗi hiển thị chi tiết.</Text>; }
    };

    // --- UI Chính ---
    const calendarKey = currentMonthDate instanceof Date && !isNaN(currentMonthDate.getTime()) ? currentMonthDate.toISOString().substring(0, 7) : 'calendar-fallback-key';
    const initialCalendarDate = selectedDate || getTodayDateString();

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Header đã được quản lý bởi Stack Navigator trong App.js */}

            {/* Hiển thị loading indicator khi đang tải dữ liệu lần đầu VÀ chưa có dữ liệu */}
            {isLoading && allExamEntries.length === 0 && (
                <View style={styles.centeredMessage}>
                    <ActivityIndicator size="large" color="#002366" />
                    <Text style={styles.loadingText}>Đang tải lịch thi...</Text>
                </View>
            )}

            {/* Hiển thị thông báo lỗi nếu có (và không đang loading ban đầu) */}
            {error && !isLoading && (
                <View style={styles.centeredMessage}>
                    <FontAwesome5 name="exclamation-circle" size={40} color="#dc3545" />
                    <Text style={styles.errorText}>Không thể tải dữ liệu</Text>
                    <Text style={styles.errorDetailText}>{error}</Text>
                    {/* Nút thử lại gọi hàm fetch */}
                    <TouchableOpacity style={styles.retryButton} onPress={() => fetchMyExams()}>
                        <Text style={styles.retryButtonText}>Thử lại</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Hiển thị nội dung chính (Lịch và chi tiết) khi không loading ban đầu và không có lỗi */}
            {!error && (!isLoading || allExamEntries.length >= 0) && ( // Điều kiện đảm bảo luôn render ScrollView sau khi hết loading ban đầu
                 <ScrollView
                     style={styles.scrollView}
                     contentContainerStyle={styles.scrollViewContent}
                     refreshControl={ // Component cho phép kéo để làm mới
                          <RefreshControl
                              refreshing={refreshing} // Trạng thái loading của refresh control
                              onRefresh={onRefresh}   // Hàm gọi khi kéo
                              colors={["#002366"]}   // Màu (Android)
                              tintColor={"#002366"}  // Màu (iOS)
                          />
                      }
                     showsVerticalScrollIndicator={false}
                 >
                     {/* --- Component Lịch --- */}
                     <Calendar
                         current={selectedDate} // Hiển thị tháng chứa ngày được chọn
                         markedDates={markedDates} // Dữ liệu đánh dấu (tô nền đỏ nhạt, ngày chọn xanh)
                         markingType={'period'} // Kích hoạt kiểu đánh dấu tô nền
                         onDayPress={handleDayPress} // Xử lý khi nhấn vào một ngày
                         onMonthChange={handleMonthChange} // Xử lý khi chuyển tháng
                         monthFormat={'MM / yyyy'} // Định dạng tiêu đề tháng/năm
                         firstDay={1} // Bắt đầu tuần từ Thứ 2
                         theme={{ // Tùy chỉnh giao diện lịch
                              calendarBackground: '#ffffff',
                              textSectionTitleColor: '#555', // Màu chữ T2, T3...
                              selectedDayBackgroundColor: '#007bff', // Màu nền ngày được chọn
                              selectedDayTextColor: '#ffffff', // Chữ trắng ngày chọn
                              todayTextColor: '#e60000', // Màu chữ đỏ đậm cho ngày hôm nay
                              dayTextColor: '#2d4150', // Màu chữ ngày thường
                              textDisabledColor: '#d9e1e8', // Màu ngày tháng khác
                              // --- Style cho Period Marking ---
                              // 'stylesheet.calendar.main': { // Có thể cần custom sâu hơn nếu muốn style phức tạp
                              //     dayContainer: {
                              //         borderColor: '#ffffff'
                              //     }
                              // },
                              'stylesheet.day.period': { // Tùy chỉnh style cho period marking
                                 base: { // Style cho ô ngày
                                     // height: 34, // Chiều cao ô ngày (tùy chỉnh)
                                     // alignItems: 'center',
                                     // justifyContent: 'center'
                                 },
                                 text: { // Style cho chữ số ngày
                                    // marginTop: Platform.OS === 'android' ? 4 : 6,
                                    // fontSize: 16,
                                    // fontWeight: '300',
                                    // color: '#2d4150', // Màu chữ mặc định
                                 },
                                  // Style chữ cho ngày được chọn (ghi đè textColor của period)
                                 selectedText: {
                                      color: '#ffffff', // Chữ trắng
                                      fontWeight: 'bold',
                                  },
                                  // Style chữ cho ngày thi (ghi đè dayTextColor)
                                  markedText: {
                                       color: '#c62828', // Màu chữ đỏ đậm cho ngày thi
                                       // fontWeight: 'bold', // Có thể làm đậm chữ ngày thi
                                   }
                             },
                             // --- Các style khác ---
                             arrowColor: '#0056b3',
                             monthTextColor: '#002366',
                             indicatorColor: 'blue',
                             textDayFontWeight: '400',
                             textMonthFontWeight: 'bold',
                             textDayHeaderFontWeight: '500',
                             textDayFontSize: 15,
                             textMonthFontSize: 16,
                             textDayHeaderFontSize: 13
                          }}
                         style={styles.calendar}
                     />
                     {/* --- Phần hiển thị chi tiết của ngày được chọn --- */}
                     <View style={styles.selectedDayContainer}>
                         {/* Hiển thị loading nhỏ khi đang refresh */}
                          {refreshing && <ActivityIndicator size="small" color="#002366" style={{marginTop: 20}} />}
                         {/* Render chi tiết hoặc thông báo rỗng */}
                         {!refreshing && renderSelectedDayExams()}
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
    selectedDayContainer: { paddingHorizontal: 16, paddingTop: 5, paddingBottom: 40, minHeight: 150 },
    examCard: {
        backgroundColor: '#fff', borderRadius: 8, marginBottom: 15,
        shadowColor: "#bbb", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15,
        shadowRadius: 5, elevation: 4, overflow: 'hidden', borderWidth:1, borderColor:'#f0f0f0'
    },
    redHeader: { backgroundColor: '#e63946', paddingVertical: 9, paddingHorizontal: 15 },
    redHeaderText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
    greenHeader: { backgroundColor: '#52b788', paddingVertical: 11, paddingHorizontal: 15 },
    greenHeaderText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    blueContent: { backgroundColor: '#457b9d', paddingVertical: 12, paddingHorizontal: 15 },
    contentRow: { flexDirection: 'row', marginBottom: 9, alignItems: 'center' },
    contentLabel: { color: '#f1faee', fontSize: 14, fontWeight: '500', width: 85 },
    contentValue: { color: '#ffffff', fontSize: 14, fontWeight: 'bold', flex: 1 },
    detailRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
    detailIcon: { width: 20, textAlign: 'center', marginRight: 10, color: '#666', marginTop: 2.5 },
    detailLabel: { fontSize: 14, color: '#777', width: 80, fontWeight:'500' },
    detailValue: { fontSize: 14, color: '#333', flex: 1, fontWeight: '500' },
    noEntriesText:{ textAlign: 'center', marginTop: 30, marginBottom: 20, color: '#888', fontSize: 15, fontStyle: 'italic' }
});

export default ExamScheduleScreen;