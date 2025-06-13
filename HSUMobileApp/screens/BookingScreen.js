// screens/BookingScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react'; // Thêm useRef
import {View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,Platform, Alert, ActivityIndicator, Modal} from 'react-native';
import { RadioButton, Provider as PaperProvider } from 'react-native-paper';                   // Cần cài: npm install react-native-paper
import { Picker } from '@react-native-picker/picker';                                        // Cần cài: expo install @react-native-picker/picker
import AsyncStorage from '@react-native-async-storage/async-storage';                           // Cần cài: expo install @react-native-async-storage/async-storage
import DateTimePicker from '@react-native-community/datetimepicker';                           // Cần cài: expo install @react-native-community/datetimepicker
import { SafeAreaView } from 'react-native-safe-area-context';                               // Cần cài: expo install react-native-safe-area-context
import { FontAwesome5 } from '@expo/vector-icons';                                           // Expo đã có sẵn hoặc expo install @expo/vector-icons
import { useNavigation, useFocusEffect } from '@react-navigation/native';

// --- Component con: LabeledInput ---
const LabeledInput = React.memo(({ label, value, onChangeText, placeholder, keyboardType = 'default', editable = true, multiline = false, numberOfLines = 1 }) => (
  <View style={styles.inputGroup}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, !editable && styles.disabledInput, multiline && styles.multilineInput]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#adb5bd"
      keyboardType={keyboardType}
      editable={editable}
      multiline={multiline}
      numberOfLines={numberOfLines}
      textAlignVertical={multiline ? 'top' : 'center'}
    />
  </View>
));

// --- Component con: RadioSelection ---
const RadioSelection = React.memo(({ label, value, status, onPress }) => (
  <TouchableOpacity style={styles.radioRow} onPress={() => onPress(value)}>
    <RadioButton value={value} status={status} onPress={() => onPress(value)} color="#002366" />
    <Text style={styles.radioLabel}>{label}</Text>
  </TouchableOpacity>
));

// --- Component con: ModalPicker ---
const ModalPicker = React.memo(({ label, options = [], selectedValue, onValueChange, placeholder = "Chọn...", isLoading = false, testID }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [tempValue, setTempValue] = useState(selectedValue);
  // Lọc ra các option hợp lệ (có label và value, loại bỏ null/undefined khỏi options)
  const validOptions = Array.isArray(options)
        ? options.filter(option => option && typeof option.label !== 'undefined' && option.value != null)
        : [];

  // Tìm label dựa trên value, nếu không tìm thấy thì hiển thị placeholder
  const selectedOption = validOptions.find(option => option.value === selectedValue);
  const selectedLabel = selectedOption?.label ?? placeholder;


  const handleDone = () => { onValueChange(tempValue); setModalVisible(false); };
  const handleCancel = () => { setTempValue(selectedValue); setModalVisible(false); }
  useEffect(() => {
    setTempValue(selectedValue);
  }, [selectedValue]); // Chỉ cập nhật temp khi selectedValue từ prop thay đổi

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity testID={testID} style={styles.pickerTrigger} onPress={() => !isLoading && setModalVisible(true)} disabled={isLoading}>
        {isLoading ? (<ActivityIndicator size="small" color="#002366" />)
                   : (<Text style={(selectedValue != null && selectedValue !== '') ? styles.pickerTriggerText : styles.pickerPlaceholder} numberOfLines={1}>
                        {selectedLabel}
                      </Text>)}
        {!isLoading && <FontAwesome5 name="chevron-down" size={14} color="#6c757d" style={styles.pickerIcon} />}
      </TouchableOpacity>
      <Modal transparent={true} visible={modalVisible} animationType="slide" onRequestClose={handleCancel}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={handleCancel}>
          <TouchableOpacity style={styles.modalContentContainer} activeOpacity={1}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={handleCancel}><Text style={styles.modalButtonText}>Hủy</Text></TouchableOpacity>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={handleDone}><Text style={[styles.modalButtonText, styles.modalButtonDone]}>Xong</Text></TouchableOpacity>
            </View>
            <Picker
                selectedValue={tempValue}
                onValueChange={(itemValue) => setTempValue(itemValue)}
                style={styles.modalPicker}
                itemStyle={styles.pickerItemTextIOS}
            >
               <Picker.Item label={placeholder} value={null} style={styles.pickerPlaceholderItem} />
               {validOptions.map((option) => (
                 <Picker.Item key={option.value ?? `opt-${Math.random()}`} label={String(option.label)} value={option.value} />
               ))}
            </Picker>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
});


// --- API BASE URL ---
const API_BASE_URL = 'http://10.101.39.47:5000'; // <<< Đảm bảo đúng IP Backend

// --- Component Chính: BookingScreen ---
const BookingScreen = () => {
  const navigation = useNavigation();
  // const { userToken } = useContext(AuthContext); // <<< Dùng nếu có Context

  // --- State ---
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [bookingDate, setBookingDate] = useState(new Date());
  const [showDatePickerAndroid, setShowDatePickerAndroid] = useState(false);
  const [startTime, setStartTime] = useState(''); // Tự động điền
  const [endTime, setEndTime] = useState('');   // Tự động điền
  const [selectedShiftId, setSelectedShiftId] = useState(null);
  const [rawShifts, setRawShifts] = useState([]); // Lưu data shift gốc
  const [attendees, setAttendees] = useState('');
  const [purposeText, setPurposeText] = useState('');
  const [selectedPurposeRadio, setSelectedPurposeRadio] = useState('');
  const [notes, setNotes] = useState('');
  const [agree, setAgree] = useState(false);
  const [locationsOptions, setLocationsOptions] = useState([]);
  const [shiftsOptions, setShiftsOptions] = useState([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [isLoadingShifts, setIsLoadingShifts] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMountedRef = useRef(true);

  // --- purposeOptions ---
  const purposeOptions = [
    { label: "Tổ chức sự kiện / Đồ án môn học", value: "event_project" },
    { label: "Dán poster", value: "poster" },
    { label: "Đặt bàn tư vấn", value: "consult" },
    { label: "Khác (ghi rõ ở mục đích)", value: "other" }
 ];

  // --- fetchData ---
  const fetchData = useCallback(async () => {
    if (!isMountedRef.current) return;
    console.log("BK_SCREEN: Fetching initial data...");
    setIsLoadingLocations(true); setIsLoadingShifts(true); setFetchError(null);
    let token; try { token = await AsyncStorage.getItem('userToken'); } catch (e) { console.error("BK_FETCH: Error getting token", e); }

    try {
        const headers = { Authorization: `Bearer ${token}` }; // Chuẩn bị header
        const [locResponse, shiftResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/api/locations`, { headers }),
            fetch(`${API_BASE_URL}/api/shifts`, { headers }) // API shifts cần trả về _id, name/label, startTime, endTime
        ]);

        if (!isMountedRef.current) return;

        // Xử lý Locations
        if (!locResponse.ok) throw new Error(`Locations Error: ${locResponse.status}`);
        const locData = await locResponse.json();
        if (!isMountedRef.current) return;
        if (locData.success && Array.isArray(locData.data)) {
            const formattedLocations = locData.data.map(loc => ({ label: `${loc.building || ''} - ${loc.name || ''}`, value: loc._id }));
            setLocationsOptions(formattedLocations);
        } else { throw new Error(locData.message || 'Invalid locations data'); }

        // Xử lý Shifts
        console.log("BK_FETCH: Shifts Response Status:", shiftResponse.status);
        if (!shiftResponse.ok) throw new Error(`Shifts Error: ${shiftResponse.status}`);
        const shiftData = await shiftResponse.json(); // <--- Có lỗi parse ở đây không?
        console.log("BK_FETCH: Shifts Data Received:", shiftData); // <<< XEM KỸ OUTPUT NÀY
        if (!isMountedRef.current) return;

        // <<< KIỂM TRA ĐIỀU KIỆN NÀY CÓ ĐÚNG KHÔNG? >>>
        if (shiftData.success && Array.isArray(shiftData.data)) {
            console.log("BK_FETCH: Filtering raw shifts data (success:true, data:array path)...");
            // <<< KIỂM TRA FILTER NÀY >>>
            const validShifts = shiftData.data.filter(s => s._id && (s.name || s.label) && s.startTime && s.endTime);
            console.log("BK_FETCH: Raw VALID shifts after filter:", validShifts); // <<< XEM KẾT QUẢ LỌC
            setRawShifts(validShifts);

            // <<< KIỂM TRA MAP NÀY >>>
            const formattedShifts = validShifts.map(s => ({ label: `${s.name || s.label}`, value: s._id }));
            setShiftsOptions(formattedShifts);
            console.log("BK_FETCH: Formatted Shifts for Picker:", formattedShifts); // <<< XEM KẾT QUẢ CUỐI
          }
        // <<< HOẶC KIỂM TRA ĐIỀU KIỆN NÀY CÓ ĐÚNG KHÔNG? >>>
        else if (Array.isArray(shiftData)) { // Nếu API trả về trực tiếp mảng
             console.log("BK_FETCH: Filtering raw shifts data (direct array path)...");
              // <<< KIỂM TRA FILTER NÀY >>>
             const validShifts = shiftData.filter(s => s._id && (s.name || s.label) && s.startTime && s.endTime);
             console.log("BK_FETCH: Raw VALID shifts after filter:", validShifts); // <<< XEM KẾT QUẢ LỌC
             setRawShifts(validShifts);

              // <<< KIỂM TRA MAP NÀY >>>
             const formattedShifts = validShifts.map(s => ({ label: `${s.name || s.label} (${s.startTime} - ${s.endTime})`, value: s._id }));
             setShiftsOptions(formattedShifts);
             console.log("BK_FETCH: Formatted Shifts for Picker:", formattedShifts); // <<< XEM KẾT QUẢ CUỐI
            }
        else {
             // Nếu không rơi vào 2 trường hợp trên
             console.error("BK_FETCH: Shifts data invalid or unexpected structure", shiftData);
             throw new Error(shiftData.message || 'Invalid shifts data structure');
        }

    } catch (error) {
        console.error("BK_FETCH: Fetch error:", error);
        if (isMountedRef.current) { setFetchError(error.message || "Lỗi tải dữ liệu."); setLocationsOptions([{ label: 'Lỗi', value: null }]); setShiftsOptions([{ label: 'Lỗi', value: null }]); }
    } finally {
        if (isMountedRef.current) { setIsLoadingLocations(false); setIsLoadingShifts(false); }
        console.log("BK_SCREEN: Fetch complete.");
    }
  }, []); // Fetch data không phụ thuộc state nào

  // --- useEffect để gọi fetchData ---
  useEffect(() => {
      isMountedRef.current = true; fetchData();
      return () => { isMountedRef.current = false; };
  }, [fetchData]);

  // --- Handlers ---
   const handleDateChange = (event, selectedDate) => { const currentDate = selectedDate || bookingDate; if (Platform.OS === 'android') { setShowDatePickerAndroid(false); } setBookingDate(currentDate); };
   const formatDateForDisplay = (date) => { if (!date) return ''; let day = date.getDate().toString().padStart(2, '0'); let month = (date.getMonth() + 1).toString().padStart(2, '0'); let year = date.getFullYear(); return `${day}/${month}/${year}`; };
   const formatDateForAPI = (date) => { if (!date) return ''; return date.toISOString().split('T')[0]; };

    // --- HÀM XỬ LÝ KHI CHỌN CA HỌC ---
    const handleShiftChange = useCallback((shiftId) => {
        console.log("BK_SHIFT_CHANGE: Selected Shift ID:", shiftId);
        setSelectedShiftId(shiftId);
        const selected = rawShifts.find(s => s._id === shiftId);
        if (selected) {
            console.log("BK_SHIFT_CHANGE: Found details:", selected);
            setStartTime(selected.startTime);
            setEndTime(selected.endTime);
        } else {
            console.log("BK_SHIFT_CHANGE: Not found/placeholder.");
            setStartTime('');
            setEndTime('');
        }
    }, [rawShifts]);


   const handleSendBooking = async () => {
        // --- Kiểm tra input ---
        if (!phoneNumber.trim()) return Alert.alert('Thiếu thông tin', 'Vui lòng nhập Số điện thoại.');
        if (!selectedLocationId) return Alert.alert('Thiếu thông tin', 'Vui lòng chọn Địa điểm.');
        if (!selectedShiftId) return Alert.alert('Thiếu thông tin', 'Vui lòng chọn Ca học.');
        if (!startTime || !endTime) return Alert.alert('Lỗi thời gian', 'Vui lòng chọn lại ca học hợp lệ.');
        if (!attendees.trim() || isNaN(Number(attendees)) || Number(attendees) <= 0) return Alert.alert('Không hợp lệ', 'Số người tham dự không hợp lệ.');
        if (!selectedPurposeRadio) return Alert.alert('Thiếu thông tin', 'Vui lòng chọn Mục đích sử dụng.');
        if (selectedPurposeRadio === 'other' && !purposeText.trim()) return Alert.alert('Thiếu thông tin', 'Vui lòng nhập Mục đích chi tiết.');
        if (!agree) return Alert.alert('Xác nhận', 'Vui lòng đồng ý với chính sách đặt phòng.');

        // --- Chuẩn bị dữ liệu ---
        const bookingData = {
          locationId: selectedLocationId,
          shiftId: selectedShiftId,
          bookingDate: formatDateForAPI(bookingDate),
          startTime, endTime,
          numberOfParticipants: Number(attendees),
          
          purpose: selectedPurposeRadio, 
          purposeDetail: selectedPurposeRadio === 'other' ? purposeText.trim() : '',
          
          notes: notes.trim(),
          phoneNumber: phoneNumber.trim()
       };

        console.log("BK_SEND: Sending data:", JSON.stringify(bookingData, null, 2));
        setIsSubmitting(true);
        let token;
        try {
            token = await AsyncStorage.getItem('userToken'); if (!token) throw new Error("Token không hợp lệ.");
            const response = await fetch(`${API_BASE_URL}/api/bookings`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(bookingData) });
            const responseText = await response.text(); console.log("BK_SEND: Raw Response:", responseText); let result; try { result = JSON.parse(responseText); } catch (e) { throw new Error(`Lỗi parse JSON: ${responseText}`); }
            if (response.ok && result.success) { Alert.alert("Thành công!", result.message || "Yêu cầu đã gửi!"); navigation.goBack(); }
            else { throw new Error(result.message || `Lỗi server (${response.status})`); }
        } catch (error) { console.error("BK_SEND: API Error:", error); Alert.alert("Gửi thất bại", error.message || "Có lỗi xảy ra."); }
        finally { setIsSubmitting(false); }
   };

  // --- Render UI ---
  if (fetchError && !isLoadingLocations && !isLoadingShifts) { return ( <SafeAreaView style={styles.safeArea}><View style={styles.centered}><Text style={styles.errorText}>Lỗi tải dữ liệu:</Text><Text style={styles.errorText}>{fetchError}</Text></View></SafeAreaView> ); }

  return (
    <PaperProvider>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" >

          <LabeledInput label="Số điện thoại" value={phoneNumber} onChangeText={setPhoneNumber} placeholder="Nhập số điện thoại liên hệ..." keyboardType="phone-pad" />

          <View style={styles.inputGroup}>
              <Text style={styles.label}>Ngày đặt</Text>
              {Platform.OS === 'ios' ? ( <DateTimePicker value={bookingDate} mode={'date'} display="spinner" onChange={handleDateChange} style={styles.iosDatePicker} locale="vi-VN" minimumDate={new Date()} /> ) : ( <TouchableOpacity style={styles.datePickerTrigger} onPress={() => setShowDatePickerAndroid(true)} > <Text style={styles.datePickerText}>{formatDateForDisplay(bookingDate)}</Text> <FontAwesome5 name="calendar-alt" size={18} color="#6c757d" /> </TouchableOpacity> )}
          </View>
          {Platform.OS === 'android' && showDatePickerAndroid && ( <DateTimePicker value={bookingDate} mode={'date'} display="default" onChange={handleDateChange} minimumDate={new Date()} /> )}

          <ModalPicker label="Địa điểm" options={locationsOptions} selectedValue={selectedLocationId} onValueChange={setSelectedLocationId} placeholder="Chọn địa điểm..." isLoading={isLoadingLocations} />

           <ModalPicker label="Ca học" options={shiftsOptions} selectedValue={selectedShiftId} onValueChange={handleShiftChange} placeholder="Chọn ca học..." isLoading={isLoadingShifts} />

          {/* Thời gian hiển thị tự động */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Thời gian</Text>
            <View style={styles.timeRow}>
              <View style={[styles.input, styles.disabledInput, styles.timeInput]}><Text style={styles.timeDisplayText}>{startTime || '--:--'}</Text></View>
              <Text style={styles.timeSeparator}>–</Text>
              <View style={[styles.input, styles.disabledInput, styles.timeInput]}><Text style={styles.timeDisplayText}>{endTime || '--:--'}</Text></View>
            </View>
          </View>

          <LabeledInput label="Số người tham dự" value={attendees} onChangeText={setAttendees} keyboardType="number-pad" placeholder="Nhập số lượng" />

          <LabeledInput label="Mục đích (chi tiết nếu chọn Khác)" value={purposeText} onChangeText={setPurposeText} placeholder="Ví dụ: Họp nhóm..." editable={selectedPurposeRadio === 'other'} />

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mục đích sử dụng</Text>
            <RadioButton.Group onValueChange={setSelectedPurposeRadio} value={selectedPurposeRadio}>
              {purposeOptions.map(option => ( <RadioSelection key={option.value} label={option.label} value={option.value} status={selectedPurposeRadio === option.value ? 'checked' : 'unchecked'} onPress={setSelectedPurposeRadio} /> ))}
            </RadioButton.Group>
          </View>

          <LabeledInput label="Mô tả / Ghi chú thêm" value={notes} onChangeText={setNotes} placeholder="Yêu cầu thêm về thiết bị,..." multiline numberOfLines={4} />

          <TouchableOpacity style={styles.agreementRow} onPress={() => setAgree(!agree)}>
            <RadioButton value="agree" status={agree ? 'checked' : 'unchecked'} onPress={() => setAgree(!agree)} color="#002366" />
            <Text style={styles.agreementText}> Tôi cam kết tuân thủ <Text style={styles.policyLink} onPress={() => Alert.alert('Chính sách', 'Nội dung chính sách đặt phòng...')}> chính sách đặt phòng </Text> </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.submitButton, (!agree || isSubmitting) && styles.submitButtonDisabled]} onPress={handleSendBooking} disabled={!agree || isSubmitting}>
            {isSubmitting ? (<ActivityIndicator size="small" color="#fff" />) : (<Text style={styles.submitButtonText}>Gửi Yêu Cầu</Text>)}
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </PaperProvider>
  );
};

// --- StyleSheet ---
const styles = StyleSheet.create({
  safeArea:{flex:1,backgroundColor:'#f8f9fa'},
  container:{flex:1},
  scrollContent:{paddingVertical:20,paddingHorizontal:16,paddingBottom:40},
  inputGroup:{marginBottom:22},
  label:{fontSize:15,fontWeight:'600',color:'#495057',marginBottom:8},
  input:{backgroundColor:'#fff',borderWidth:1,borderColor:'#dee2e6',borderRadius:8,paddingHorizontal:14,paddingVertical:Platform.OS==='ios'?12:10,fontSize:15,color:'#212529', minHeight: 48},
  disabledInput:{backgroundColor:'#e9ecef',color:'#6c757d'},
  multilineInput:{height:100,paddingTop:12},
  pickerTrigger:{backgroundColor:'#fff',borderWidth:1,borderColor:'#dee2e6',borderRadius:8,paddingHorizontal:14,paddingVertical:12,minHeight:48,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  pickerTriggerText:{fontSize:15,color:'#212529'},
  pickerPlaceholder:{fontSize:15,color:'#adb5bd'},
  pickerIcon:{marginLeft: 5},
  loadingIndicator:{alignSelf:'center',paddingVertical:15},
  modalOverlay:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.4)'},
  modalContentContainer:{backgroundColor:'#f8f9fa',borderTopLeftRadius:15,borderTopRightRadius:15,paddingBottom: Platform.OS === 'ios' ? 30 : 20, maxHeight: '60%'},
  modalHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:12,paddingHorizontal:16,borderBottomWidth:1,borderBottomColor:'#dee2e6'},
  modalTitle:{fontSize:16,fontWeight:'600',color:'#495057'},
  modalButtonText:{fontSize:16,color:'#007bff'},
  modalButtonDone:{fontWeight:'bold'},
  modalPicker:{width:'100%',backgroundColor:Platform.OS==='ios'?'#f8f9fa':undefined},
  pickerItemTextIOS:{color:'#000',fontSize:17},
  pickerPlaceholderItem:{ color: '#adb5bd'},
  timeRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  timeInput:{flex:.45,textAlign:'center', justifyContent: 'center', alignItems: 'center'}, // <<< Thêm alignItems
   timeDisplayText: {
       fontSize: 15,
       color: '#495057',
       fontWeight: '500'
   },
  timeSeparator:{fontSize:18,color:'#6c757d',fontWeight:'bold',marginHorizontal:5},
  radioRow:{flexDirection:'row',alignItems:'center',marginBottom:12},
  radioLabel:{fontSize:15,color:'#212529',marginLeft:8},
  agreementRow:{flexDirection:'row',alignItems:'center',marginVertical:15,paddingVertical:5},
  agreementText:{flex:1,fontSize:14,color:'#495057',marginLeft:8,lineHeight:20},
  policyLink:{color:'#0056b3',fontWeight:'bold', textDecorationLine: 'underline'},
  submitButton:{backgroundColor:'#002366',paddingVertical:15,borderRadius:10,alignItems:'center',marginTop:10,shadowColor:'#000',shadowOffset:{width:0,height:2},shadowOpacity:.15,shadowRadius:3,elevation:3},
  submitButtonDisabled:{backgroundColor:'#adb5bd',elevation:0,shadowOpacity:0},
  submitButtonText:{color:'#fff',fontSize:16,fontWeight:'bold'},
  datePickerTrigger:{backgroundColor:'#fff',borderWidth:1,borderColor:'#dee2e6',borderRadius:8,paddingHorizontal:14,paddingVertical:12,flexDirection:'row',justifyContent:'space-between',alignItems:'center', minHeight: 48},
  datePickerText:{fontSize:15,color:'#212529'},datePickerPlaceholder:{fontSize:15,color:'#adb5bd'},
  iosDatePicker:{height: Platform.OS === 'ios' ? 150 : undefined},
  centered:{flex:1,justifyContent:'center',alignItems:'center',padding:20},errorText:{color:'red',fontSize:16,textAlign:'center',marginBottom:10}
});

export default BookingScreen;