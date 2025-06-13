// screens/AttendanceScreen.js
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Alert, TouchableOpacity, Modal, Dimensions,Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Để lấy/lưu token
import { useFocusEffect, useNavigation } from '@react-navigation/native'; // Hooks điều hướng và focus
import { SafeAreaView } from 'react-native-safe-area-context'; // Đảm bảo hiển thị đúng
import { FontAwesome5 } from '@expo/vector-icons'; // Để dùng icon (đảm bảo đã cài)
import { Picker } from '@react-native-picker/picker'; // <-- Import Picker cho Modal (Đảm bảo đã cài)

const API_BASE_URL = 'http://10.101.39.47:5000'; // <-- Kiểm tra IP/URL Backend
const screenWidth = Dimensions.get('window').width; // Lấy chiều rộng màn hình

// --- Component con: Hiển thị một MÔN HỌC trong danh sách tổng hợp ---
// Component này nhận dữ liệu tổng hợp của một môn và hàm để mở modal chi tiết
const AttendanceSummaryItem = React.memo(({ item, onPressDetails }) => {
    // item: { courseId, courseCode, courseName, totalSessions, presentCount, absentCount, lateCount, excusedCount }

    // Logic xác định xem có vấn đề về chuyên cần để cảnh báo (ví dụ)
    const hasIssues = (item?.absentCount ?? 0) >= 2 || (item?.lateCount ?? 0) >= 3;
    // Logic xác định có cần hiển thị nút xem chi tiết không
    const showDetailsButton = (item?.absentCount ?? 0) > 0 || (item?.lateCount ?? 0) > 0 || (item?.excusedCount ?? 0) > 0;

    return (
        // Card chứa thông tin tổng hợp của môn học
        <View style={[styles.summaryCard, hasIssues && styles.summaryCardWarning]}>
            {/* Hàng trên cùng: Tên môn và Mã môn */}
            <View style={styles.summaryHeader}>
                <Text style={styles.summaryCourseName} numberOfLines={2}>{item?.courseName || 'Không có tên môn'}</Text>
                <Text style={styles.summaryCourseCode}>{item?.courseCode || 'N/A'}</Text>
            </View>
            {/* Hàng hiển thị các số liệu thống kê điểm danh */}
            <View style={styles.summaryStatsRow}>
                 <View style={styles.summaryStatItem}><Text style={styles.statValuePresent}>{item?.presentCount ?? '-'}</Text><Text style={styles.statLabel}>Có mặt</Text></View>
                 <View style={styles.summaryStatItem}><Text style={styles.statValueLate}>{item?.lateCount ?? '-'}</Text><Text style={styles.statLabel}>Đi trễ</Text></View>
                 <View style={styles.summaryStatItem}><Text style={styles.statValueAbsent}>{item?.absentCount ?? '-'}</Text><Text style={styles.statLabel}>Vắng KP</Text></View>
                 <View style={styles.summaryStatItem}><Text style={styles.statValueExcused}>{item?.excusedCount ?? '-'}</Text><Text style={styles.statLabel}>Vắng CP</Text></View>
                 <View style={styles.summaryStatItem}><Text style={styles.statValueTotal}>{item?.totalSessions ?? '-'}</Text><Text style={styles.statLabel}>Tổng buổi</Text></View>
            </View>
             {/* Nút "Xem chi tiết vắng/trễ/phép" (chỉ hiện khi cần) */}
             {showDetailsButton && (
                 <TouchableOpacity style={styles.detailsButton} onPress={() => onPressDetails(item)}>
                     <Text style={styles.detailsButtonText}>Xem chi tiết vắng/trễ/phép</Text>
                     <FontAwesome5 name="chevron-right" size={12} color="#007bff" />
                 </TouchableOpacity>
              )}
        </View>
    );
});

// --- Component con: Hiển thị chi tiết một buổi Vắng/Trễ/Phép trong Modal ---
const AttendanceDetailItem = React.memo(({ item }) => {
     // item: bản ghi từ Timetable (API details) - chỉ chứa buổi vắng/trễ/phép
     let statusColor = '#6c757d'; let statusIcon = 'question-circle'; let statusText = item?.attendanceStatus || 'N/A';
     // Xác định màu sắc, icon và text dựa trên trạng thái điểm danh
     switch (item?.attendanceStatus) {
         case 'Absent': statusColor = '#dc3545'; statusIcon = 'times-circle'; statusText = 'Vắng KP'; break;
         case 'Late': statusColor = '#ffc107'; statusIcon = 'clock'; statusText = 'Đi trễ'; break;
         case 'Excused': statusColor = '#17a2b8'; statusIcon = 'info-circle'; statusText = 'Vắng CP'; break;
         default: return null; // Chỉ hiển thị 3 trạng thái này trong modal chi tiết
     }
     // Format ngày hiển thị DD/MM/YYYY
     const displayDate = item?.date ? new Date(item.date + 'T00:00:00Z').toLocaleDateString('vi-VN', { timeZone: 'UTC', day:'2-digit', month:'2-digit', year:'numeric' }) : 'N/A';
     return (
         // Container cho một dòng chi tiết
         <View style={styles.detailItemContainer}>
              {/* Badge hiển thị trạng thái */}
              <View style={[styles.detailStatusBadge, {backgroundColor: statusColor}]}>
                   <FontAwesome5 name={statusIcon} size={12} color={statusColor === '#ffc107' ? '#000' : '#fff'} />
                   <Text style={[styles.detailStatusText, statusColor === '#ffc107' && { color: '#000' }]}>{statusText}</Text>
              </View>
              {/* Thông tin ngày giờ và ghi chú */}
              <View style={styles.detailInfo}>
                  <Text style={styles.detailDateText}>Ngày: {displayDate} ({item.startTime || '?'} - {item.endTime || '?'})</Text>
                  {item.attendanceNotes && <Text style={styles.detailNotesText}>Ghi chú: {item.attendanceNotes}</Text>}
              </View>
         </View>
      );
 });

// --- Component con: Modal Chọn Học Kỳ (Sử dụng Picker bên trong Modal) ---
const ModalSemesterPicker = React.memo(({ label, options = [], selectedValue, onValueChange, placeholder = "Chọn học kỳ..." }) => {
    const [modalVisible, setModalVisible] = useState(false); // State quản lý hiển thị modal
    const [tempValue, setTempValue] = useState(selectedValue); // State lưu giá trị tạm thời khi chọn trong modal
    // Tìm label của học kỳ đang được chọn để hiển thị trên nút bấm
    const selectedLabel = options.find(option => option === selectedValue) || placeholder;

    // Hàm xử lý khi nhấn nút "Xong" trong modal
    const handleDone = () => {
        onValueChange(tempValue); // Gọi hàm cập nhật state ở component cha với giá trị đã chọn
        setModalVisible(false); // Đóng modal
    };

    // Hàm xử lý khi nhấn nút "Hủy" hoặc bấm ra ngoài modal
    const handleCancel = () => {
        setTempValue(selectedValue); // Reset giá trị tạm về giá trị đang được chọn hiện tại
        setModalVisible(false); // Đóng modal
    }

    // Effect để cập nhật giá trị tạm thời khi giá trị được chọn thật (selectedValue) thay đổi từ bên ngoài
    useEffect(() => {
        setTempValue(selectedValue);
    }, [selectedValue]);

    return (
        <View style={styles.pickerRow}>
            {/* Hiển thị label "Học kỳ:" */}
            {label && <Text style={styles.semesterLabel}>{label}</Text>}
            {/* Nút bấm để mở Modal */}
            <TouchableOpacity style={styles.pickerTrigger} onPress={() => setModalVisible(true)}>
                {/* Hiển thị học kỳ đang chọn hoặc placeholder */}
                <Text style={selectedValue ? styles.pickerTriggerText : styles.pickerPlaceholder} numberOfLines={1}>
                    {selectedLabel}
                </Text>
                {/* Icon mũi tên dropdown */}
                <FontAwesome5 name="chevron-down" size={14} color="#6c757d" style={styles.pickerIcon} />
            </TouchableOpacity>

            {/* === Modal Popup === */}
            <Modal
                transparent={true} // Nền trong suốt
                visible={modalVisible} // Hiện/ẩn dựa trên state
                animationType="slide" // Hiệu ứng trượt lên từ dưới
                onRequestClose={handleCancel} // Xử lý khi bấm nút back cứng (Android)
            >
                {/* Lớp phủ mờ */}
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={handleCancel}>
                    {/* Nội dung Modal (TouchableOpacity để ngăn bấm xuyên qua) */}
                    <TouchableOpacity style={styles.modalContent} activeOpacity={1}>
                        {/* Header của Modal: Nút Hủy, Tiêu đề, Nút Xong */}
                        <View style={styles.modalHeader}>
                             <TouchableOpacity onPress={handleCancel}><Text style={styles.modalButtonText}>Hủy</Text></TouchableOpacity>
                             <Text style={styles.modalPickerTitle}>{label || 'Chọn'}</Text>
                             <TouchableOpacity onPress={handleDone}><Text style={[styles.modalButtonText, styles.modalButtonDone]}>Xong</Text></TouchableOpacity>
                         </View>
                         {/* Component Picker để chọn học kỳ */}
                         <Picker
                             selectedValue={tempValue} // Giá trị đang được chọn trong Picker
                             onValueChange={(itemValue) => setTempValue(itemValue)} // Cập nhật giá trị tạm thời khi chọn
                             style={styles.modalPicker} // Style chung cho Picker
                             itemStyle={styles.pickerItemTextIOS} // Style riêng cho chữ của item trên iOS
                         >
                             {/* Render danh sách các học kỳ */}
                             {options.map(optionLabel => (
                                 <Picker.Item key={optionLabel} label={optionLabel} value={optionLabel} />
                             ))}
                         </Picker>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
});


// ===========================================
// === COMPONENT CHÍNH: AttendanceScreen =====
// ===========================================
const AttendanceScreen = () => {
    const navigation = useNavigation();
    // --- State Variables ---
    const [allAttendanceData, setAllAttendanceData] = useState([]); // Lưu dữ liệu gốc dạng section [{ title: 'HK...', data: [...] }, ...]
    const [semesters, setSemesters] = useState([]); // Mảng các label học kỳ ['HK1 (2023-2024)', ...] cho Picker
    const [selectedSemesterKey, setSelectedSemesterKey] = useState(null); // Lưu label kỳ đang chọn
    const [isLoading, setIsLoading] = useState(true); // Loading cho màn hình chính
    const [error, setError] = useState(null); // Lỗi fetch dữ liệu tổng hợp
    const [refreshing, setRefreshing] = useState(false); // Pull-to-refresh
    // --- States cho Modal chi tiết ---
    const [modalVisible, setModalVisible] = useState(false); // Hiển thị/ẩn modal
    const [selectedCourseForDetails, setSelectedCourseForDetails] = useState(null); // Lưu thông tin môn đang xem chi tiết
    const [detailedAttendanceRecords, setDetailedAttendanceRecords] = useState([]); // Lưu danh sách buổi vắng/trễ/phép
    const [isLoadingDetails, setIsLoadingDetails] = useState(false); // Loading trong modal
    const [detailError, setDetailError] = useState(null); // Lỗi khi fetch chi tiết
    // --- Ref ---
    const isFetchingRef = useRef(false); // Ngăn fetch chồng chéo

     // --- Hàm xử lý dữ liệu sau khi fetch Summary ---
     // Tách danh sách học kỳ và tự động chọn kỳ mới nhất
     const processFetchedSummary = useCallback((data) => {
        if (!Array.isArray(data)) { setSemesters([]); return; };
        console.log("[AttendanceScreen] Processing summary data...");
        // 1. Lấy danh sách học kỳ duy nhất từ 'title' của mỗi section
        const semesterLabels = data.map(section => section.title).filter(Boolean);
        // Sắp xếp lại học kỳ (năm giảm dần, kỳ tăng dần)
        semesterLabels.sort((a, b) => {
             const [, yearA] = a.match(/ \((\d{4}-\d{4})\)/) || [];
             const [, yearB] = b.match(/ \((\d{4}-\d{4})\)/) || [];
              if (yearB !== yearA) return yearB.localeCompare(a.year); // So sánh năm học
              // So sánh học kỳ
              const semesterOrder = {'Học kỳ 1': 1, 'Học kỳ Tết': 2, 'Học kỳ 2': 3, 'Học kỳ Hè': 4};
              const semA = a.split(' (')[0]; const semB = b.split(' (')[0];
              return (semesterOrder[semA] || 99) - (semesterOrder[semB] || 99);
         });
        setSemesters(semesterLabels); // Cập nhật state danh sách học kỳ

        // 2. Chọn học kỳ mới nhất làm mặc định nếu chưa có lựa chọn hoặc lựa chọn cũ không còn tồn tại
        const currentSelectionIsValid = selectedSemesterKey && semesterLabels.includes(selectedSemesterKey);
        if (semesterLabels.length > 0 && !currentSelectionIsValid) {
            console.log("[AttendanceScreen] Setting default selected semester:", semesterLabels[0]);
            setSelectedSemesterKey(semesterLabels[0]); // Chọn kỳ đầu tiên (mới nhất)
        } else if (semesterLabels.length === 0) {
            setSelectedSemesterKey(null); // Reset nếu không có học kỳ nào
        }
    }, [selectedSemesterKey]); // Chỉ re-run nếu selectedSemesterKey thay đổi (để giữ lựa chọn của user)

    // --- Hàm fetch dữ liệu TỔNG HỢP ĐIỂM DANH THEO KỲ ---
    const fetchAttendanceSummary = useCallback(async (isRefreshing = false) => {
        if (isFetchingRef.current && !isRefreshing) { if(isRefreshing) setRefreshing(false); return; }
        isFetchingRef.current = true;
        if (!isRefreshing) setIsLoading(true); setError(null);
        console.log('[AttendanceScreen] Fetching attendance summary...');
        let token;
        try {
            token = await AsyncStorage.getItem('userToken'); if (!token) throw new Error('Token không tồn tại...');
            // Gọi API backend lấy dữ liệu tổng hợp
            const apiUrl = `${API_BASE_URL}/api/attendance/summary`;
            const response = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${token}` } });
            let result = JSON.parse(await response.text());
            console.log(`[AttendanceScreen] Summary API Status: ${response.status}`);

            if (response.ok && result.success && Array.isArray(result.data)) {
                 // Đảm bảo dữ liệu trả về có dạng [{ title: '...', data: [...] }]
                 const sectionsData = result.data.map(section => ({
                     title: section.title || section.semesterInfo || 'Không rõ kỳ',
                     data: section.data || section.courses || []
                 }));
                 console.log('[AttendanceScreen] Fetched Summary Data (Processed):', sectionsData.length);
                 setAllAttendanceData(sectionsData); // Lưu dữ liệu gốc đã xử lý key
                 processFetchedSummary(sectionsData); // Xử lý để lấy danh sách kỳ và chọn mặc định
            } else { throw new Error(result.message || `Lỗi ${response.status}`); }
        } catch (err) { console.error('[AttendanceScreen] Error fetching summary:', err); setError(err.message); setAllAttendanceData([]); setSemesters([]); setSelectedSemesterKey(null); if (String(err.message).includes('Token')) { /*...*/ }}
        finally { if (!isRefreshing) setIsLoading(false); setRefreshing(false); isFetchingRef.current = false; }
    }, [navigation, processFetchedSummary, selectedSemesterKey]); // Thêm dependency

    // --- Hàm fetch CHI TIẾT các buổi Vắng/Trễ/Phép của một môn ---
     const fetchAttendanceDetails = useCallback(async (courseId) => {
         if (!courseId) return; setIsLoadingDetails(true); setDetailError(null); setDetailedAttendanceRecords([]);
         console.log(`[AttendanceScreen] Fetching details for course: ${courseId}...`);
         let token;
         try {
             token = await AsyncStorage.getItem('userToken'); if (!token) throw new Error('...');
             // Gọi API backend lấy chi tiết (chỉ các buổi vắng/trễ/phép)
             const apiUrl = `${API_BASE_URL}/api/attendance/details?courseId=${courseId}&status=Absent,Late,Excused`;
             console.log(`[AttendanceScreen] Calling Detail API: ${apiUrl}`);
             const response = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${token}` } });
             let result = JSON.parse(await response.text());
             console.log(`[AttendanceScreen] Detail API Status: ${response.status}`);
             if (response.ok && result.success && Array.isArray(result.data)) {
                  console.log(`[AttendanceScreen] Fetched ${result.count ?? 0} detail records.`);
                 setDetailedAttendanceRecords(result.data); // Lưu dữ liệu chi tiết
             } else { throw new Error(result.message || `Lỗi ${response.status}`); }
         } catch (err) { console.error('[AttendanceScreen] Error fetching details:', err); setDetailError(err.message || "Không tải được chi tiết."); setDetailedAttendanceRecords([]); if (String(err.message).includes('Token')) {/*...*/}}
          finally { setIsLoadingDetails(false); }
     }, [navigation]); // Thêm navigation

    // --- Fetch dữ liệu tổng hợp lần đầu khi màn hình mount ---
     useEffect(() => {
         console.log("[AttendanceScreen] Component mounted, fetching initial summary data.");
         fetchAttendanceSummary();
     }, []); // Chạy một lần

    // --- Kéo refresh ---
    const onRefresh = useCallback(() => {
        console.log("[AttendanceScreen] Refreshing data...");
        setRefreshing(true);
        fetchAttendanceSummary(true); // Fetch lại dữ liệu tổng hợp
    }, [fetchAttendanceSummary]); // Phụ thuộc hàm fetch

    // --- Hàm mở Modal xem chi tiết ---
     const handleViewDetails = useCallback((courseItem) => {
         if (courseItem?.courseId) {
             setSelectedCourseForDetails(courseItem); // <-- Lưu thông tin môn
             setModalVisible(true);                   // Mở modal
             fetchAttendanceDetails(courseItem.courseId); // <-- Fetch chi tiết
         } else { Alert.alert("Lỗi", "Không tìm thấy ID môn học."); }
     }, [fetchAttendanceDetails]); // Phụ thuộc hàm fetch chi tiết

     // --- Hàm đóng Modal ---
     const handleCloseModal = useCallback(() => {
         setModalVisible(false);
         setTimeout(() => { setSelectedCourseForDetails(null); setDetailedAttendanceRecords([]); setDetailError(null); setIsLoadingDetails(false); }, 300);
     }, []); // Không có dependency động

     // --- Lọc danh sách môn học theo học kỳ đang chọn (dùng useMemo) ---
     const coursesForSelectedSemester = useMemo(() => {
         // Kiểm tra điều kiện đầu vào
         if (!selectedSemesterKey || !Array.isArray(allAttendanceData) || allAttendanceData.length === 0) {
             return []; // Trả về mảng rỗng nếu không có kỳ chọn hoặc chưa có data
         }
         // Tìm section khớp với kỳ đang chọn
         const selectedSection = allAttendanceData.find(section => section.title === selectedSemesterKey);
         // Trả về mảng data (courses) của section đó
         const courses = selectedSection?.data || [];
         console.log(`[useMemo][Attendance] Found ${courses.length} courses for semester: ${selectedSemesterKey}`);
         return courses;
     }, [allAttendanceData, selectedSemesterKey]); // Tính lại khi data gốc hoặc kỳ chọn thay đổi

    // --- Giao diện chính của màn hình ---
    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Header của Stack Navigator (Title: "Điểm danh") */}

            {/* Hiển thị Loading indicator ban đầu */}
            {isLoading && allAttendanceData.length === 0 ? (
                <View style={styles.centeredMessage}><ActivityIndicator size="large" color="#002366" /><Text style={styles.loadingText}>Đang tải dữ liệu...</Text></View>
             ) : error ? ( // Hiển thị Lỗi nếu có
                <View style={styles.centeredMessage}><FontAwesome5 name="exclamation-circle" size={40} color="#e63946" /><Text style={styles.errorText}>Không thể tải dữ liệu</Text><Text style={styles.errorDetailText}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={() => fetchAttendanceSummary()}><Text style={styles.retryButtonText}>Thử lại</Text></TouchableOpacity></View>
             ) : ( // Hiển thị Nội dung chính
                 <View style={{ flex: 1 }}>
                     {/* --- Phần Chọn Học Kỳ --- */}
                     <View style={styles.semesterSelectorContainer}>
                          <ModalSemesterPicker
                               label="Học kỳ:"
                               options={semesters} // Danh sách các kỳ có điểm danh
                               selectedValue={selectedSemesterKey} // Kỳ đang được chọn
                               onValueChange={setSelectedSemesterKey} // Hàm cập nhật state khi chọn
                               placeholder="-- Chọn học kỳ --"
                          />
                     </View>

                     {/* --- Danh sách môn học của kỳ đã chọn --- */}
                      <FlatList
                          data={coursesForSelectedSemester} // <-- Dữ liệu đã lọc theo kỳ
                          renderItem={({ item }) => <AttendanceSummaryItem item={item} onPressDetails={handleViewDetails} />} // Render card tổng hợp
                          keyExtractor={(item) => item.courseId ? item.courseId.toString() : Math.random().toString()} // Key là courseId
                          contentContainerStyle={styles.listContainer}
                          showsVerticalScrollIndicator={false}
                          refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#002366"]} tintColor={"#002366"} /> }
                          ListEmptyComponent={ // Hiển thị khi không có môn trong kỳ hoặc chưa chọn kỳ
                              !isLoading && !refreshing ? (
                                  <View style={styles.centeredMessage}>
                                       <Text style={styles.emptyText}>{selectedSemesterKey ? 'Không có dữ liệu điểm danh cho kỳ này.' : 'Vui lòng chọn học kỳ để xem.'}</Text>
                                  </View>
                              ) : null
                          }
                      />
                 </View>
             )}

             {/* === Modal hiển thị chi tiết === */}
              <Modal transparent={true} visible={modalVisible} animationType="fade" onRequestClose={handleCloseModal}>
                  <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={handleCloseModal}>
                      <TouchableOpacity style={styles.modalContent} activeOpacity={1}>
                          <Text style={styles.modalTitle} numberOfLines={1}>{selectedCourseForDetails?.courseName || 'Chi tiết'}</Text>
                           {isLoadingDetails ? (<ActivityIndicator size="large" color="#002366" style={{ marginVertical: 40 }}/>)
                           : detailError ? (<Text style={[styles.errorText, {marginTop: 20}]}>{detailError}</Text>)
                           : detailedAttendanceRecords.length > 0 ? ( // <-- Dùng tên state đúng
                               <FlatList
                                   data={detailedAttendanceRecords} // <-- Dùng tên state đúng
                                   renderItem={({ item }) => <AttendanceDetailItem item={item} />}
                                   keyExtractor={(item) => item._id ? item._id.toString() : Math.random().toString()}
                                   ItemSeparatorComponent={() => <View style={styles.modalSeparator} />}
                                   style={styles.modalList}
                               />
                           ) : (<Text style={styles.noEntriesText}>Không có buổi vắng/trễ/phép.</Text>)}
                           <TouchableOpacity style={styles.modalCloseButton} onPress={handleCloseModal}><Text style={styles.modalCloseButtonText}>Đóng</Text></TouchableOpacity>
                      </TouchableOpacity>
                 </TouchableOpacity>
             </Modal>

        </SafeAreaView>
    );
};

// --- StyleSheet ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#eef2f5' },
    centeredMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 25, marginTop: 30 },
    loadingText: { marginTop: 12, fontSize: 16, color: '#6c757d' },
    errorText: { marginTop: 15, fontSize: 17, fontWeight: '600', color: '#e63946', textAlign: 'center' },
    errorDetailText: { marginTop: 5, fontSize: 14, color: '#6c757d', textAlign: 'center', marginBottom: 20 },
    retryButton: { backgroundColor: '#1d3557', paddingHorizontal: 25, paddingVertical: 10, borderRadius: 8, elevation: 2, shadowOpacity: 0.1 },
    retryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    emptyText: { marginTop: 15, fontSize: 16, color: '#6c757d', textAlign:'center' },
    listContainer: { paddingHorizontal: 12, paddingBottom: 20, paddingTop: 10, flexGrow: 1 },
    semesterSelectorContainer: { paddingTop: 12, paddingBottom: 12, paddingHorizontal: 15, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0', elevation: 2, shadowOpacity: 0.05, shadowOffset:{width:0, height:1}, shadowRadius: 2 },
    pickerRow: { flexDirection: 'row', alignItems: 'center', },
    semesterLabel: { fontSize: 15, fontWeight: '500', color: '#34495e', marginRight: 10, },
     pickerTrigger: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0f2f5', borderRadius: 8, borderWidth: 1, borderColor: '#dfe6e9', paddingVertical: 10, paddingHorizontal: 12, height: 42 },
     pickerTriggerText: { fontSize: 15, color: '#003366', fontWeight: 'bold' },
     pickerPlaceholder: { fontSize: 15, color: '#6c757d' },
     pickerIcon: { marginLeft: 5 },
    summaryCard: { backgroundColor: '#ffffff', borderRadius: 8, marginBottom: 12, padding: 15, shadowColor: "#ccc", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2, borderWidth: 1, borderColor: '#eee' },
    summaryCardWarning: { borderColor: '#ffc107', borderWidth: 1.5 },
    summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    summaryCourseName: { flex: 1, fontSize: 15.5, fontWeight: 'bold', color: '#003366', marginRight: 10 },
    summaryCourseCode: { fontSize: 12.5, color: '#666', fontStyle: 'italic' },
    summaryStatsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 5, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
    summaryStatItem: { alignItems: 'center', minWidth: 55 },
    statValue: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
    statValuePresent: { color: '#28a745' }, statValueLate: { color: '#ffc107' }, statValueAbsent: { color: '#dc3545' }, statValueExcused: { color: '#17a2b8' }, statValueTotal: { color: '#6c757d'},
    statLabel: { fontSize: 10.5, color: '#666', textTransform: 'uppercase' },
     detailsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
     detailsButtonText: { color: '#007bff', fontSize: 13, marginRight: 5, fontWeight: '500' },
     modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }, // Đẩy modal picker xuống dưới
     modalContent: { backgroundColor: '#f8f9fa', borderTopLeftRadius: 15, borderTopRightRadius: 15, paddingBottom: 20, maxHeight: '50%' }, // Style modal picker
     modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#dee2e6'},
     modalPickerTitle:{ fontSize: 16, fontWeight: '600', color: '#495057' },
     modalButtonText:{ fontSize: 16, color: '#007bff' },
     modalButtonDone:{ fontWeight: 'bold' },
     modalPicker:{ width: '100%', backgroundColor: Platform.OS === 'ios' ? '#f8f9fa' : undefined },
     pickerItemTextIOS:{ color: '#000', fontSize: 17 },
      modalDetailContent: { // Đổi tên style content modal chi tiết
          backgroundColor: '#fff', borderRadius: 10, paddingVertical: 20, paddingHorizontal: 5, width: '90%', maxHeight: '80%', elevation: 5
      }, // Thêm style này nếu cần content modal chi tiết khác
      modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#003366', paddingHorizontal: 10 }, // Style title modal chi tiết
      modalList: { flexGrow: 0, paddingHorizontal: 10 },
      detailItemContainer: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee', paddingHorizontal: 10 },
      detailStatusBadge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 6 },
      detailStatusText: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 5 },
      detailInfo: { marginLeft: 0, marginTop: 4 },
      detailDateText: { fontSize: 14, fontWeight: '500', color: '#333', marginBottom: 4 },
      detailNotesText: { fontSize: 13, color: '#666', fontStyle: 'italic', marginTop: 2 },
      modalSeparator: { height: 0 },
       modalCloseButton: { marginTop: 15, paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#eee' },
       modalCloseButtonText: { fontSize: 16, color: '#007bff', fontWeight: '500' },
       noEntriesText:{ textAlign: 'center', marginTop: 20, marginBottom: 20, color: '#888', fontSize: 15, fontStyle: 'italic' }
});

export default AttendanceScreen; // <-- Export đúng tên component