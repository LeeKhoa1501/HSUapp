// HSUMobileApp/screens/AcademicRequestFormScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
    Platform, Alert, ActivityIndicator, Modal, KeyboardAvoidingView
} from 'react-native';
import { Picker } from '@react-native-picker/picker'; // Sử dụng Picker chuẩn của React Native
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ACADEMIC_REQUEST_TYPES } from '../assets/data/requestTypes.js'; // Đảm bảo đường dẫn này đúng

const BASE_URL = 'http://10.101.38.213:5000'; // <<< ANH NHỚ THAY IP VÀ PORT ĐÚNG >>>

// Component Input có nhãn
const LabeledInput = React.memo(({ label, value, onChangeText, placeholder, keyboardType = 'default', editable = true, multiline = false, numberOfLines = 1, required = false }) => (
  <View style={styles.inputGroup}>
    <Text style={styles.label}>{label}{required && <Text style={styles.requiredStar}> *</Text>}</Text>
    <TextInput
      style={[styles.input, !editable && styles.disabledInput, multiline && styles.multilineInput]}
      value={String(value || '')}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#ccc" // Màu placeholder nhạt hơn
      keyboardType={keyboardType}
      editable={editable}
      multiline={multiline}
      numberOfLines={numberOfLines}
      textAlignVertical={multiline ? 'top' : 'center'}
    />
  </View>
));

// Component Picker tùy chỉnh sử dụng Modal
const ModalPicker = React.memo(({ label, options = [], selectedValue, onValueChange, placeholder = "Vui lòng chọn...", isLoading = false, required = false }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [tempValue, setTempValue] = useState(selectedValue);
  const validOptions = Array.isArray(options) ? options.filter(o => o != null && o.value !== undefined && o.value !== null && o.label !== undefined && o.label !== null) : [];
  const selectedOption = validOptions.find(option => option.value === selectedValue);
  const displayLabel = selectedOption?.label ? String(selectedOption.label) : placeholder;

  const handleOpen = () => { if (!isLoading) { setTempValue(selectedValue); setModalVisible(true); }};
  const handleDone = () => { onValueChange(tempValue); setModalVisible(false); };
  const handleCancel = () => { setModalVisible(false); }

  useEffect(() => { if(!modalVisible) setTempValue(selectedValue); }, [selectedValue, modalVisible]);

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}{required && <Text style={styles.requiredStar}> *</Text>}</Text>
      <TouchableOpacity style={styles.pickerTrigger} onPress={handleOpen} disabled={isLoading}>
        {isLoading ? (<ActivityIndicator size="small" color="#003366" />) // Màu HSU
                   : (<Text style={selectedValue ? styles.pickerTriggerText : styles.pickerPlaceholder} numberOfLines={1}>{displayLabel}</Text>)}
        {!isLoading && <FontAwesome5 name="chevron-down" size={16} color="#888" style={styles.pickerIcon} />}
      </TouchableOpacity>
      <Modal transparent={true} visible={modalVisible} animationType="fade" onRequestClose={handleCancel}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={handleCancel}>
          <TouchableOpacity style={styles.modalContentContainer} activeOpacity={1}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={handleCancel} style={styles.modalHeaderButton}><Text style={styles.modalButtonTextAction}>Hủy</Text></TouchableOpacity>
              <Text style={styles.modalTitle}>{String(label || 'Chọn mục')}</Text>
              <TouchableOpacity onPress={handleDone} style={styles.modalHeaderButton}><Text style={[styles.modalButtonTextAction, styles.modalButtonDone]}>Chọn</Text></TouchableOpacity>
            </View>
            {validOptions.length > 0 ? (
                <Picker selectedValue={tempValue} onValueChange={(itemValue) => setTempValue(itemValue)} style={styles.modalPicker} itemStyle={styles.pickerItemTextIOS}>
                <Picker.Item label={String(placeholder)} value={null} style={styles.pickerPlaceholderItemIOS} />
                {validOptions.map((option, index) => ( <Picker.Item key={String(option.value ?? `opt-${index}`)} label={String(option.label || 'Lựa chọn')} value={option.value} /> ))}
                </Picker>
            ) : (<View style={styles.noOptionsContainer}><Text style={styles.noOptionsText}>{isLoading ? 'Đang tải...' : 'Không có lựa chọn.'}</Text></View>)}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
});

const AcademicRequestFormScreen = () => {
    const navigation = useNavigation();
    const isMountedRef = useRef(true);

    const [requestType, setRequestType] = useState(null);
    const [requestTitle, setRequestTitle] = useState(''); // Sẽ được tự điền hoặc cho nhập nếu type là 'OTHER_REQUEST'
    const [studentNotes, setStudentNotes] = useState(''); // Nội dung chi tiết yêu cầu
    // Các trường như Số lượng, Thành tiền có thể không cần gửi lên server nếu server tự tính hoặc là cố định
    const [quantity, setQuantity] = useState('1'); // Giữ lại nếu cần cho một số loại yêu cầu
    const [amountDisplay] = useState('Miễn phí'); // Chỉ để hiển thị

    const [locationsOptions, setLocationsOptions] = useState([]);
    const [selectedReceivingCampusId, setSelectedReceivingCampusId] = useState(null);
    const [isLoadingLocations, setIsLoadingLocations] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [initialDataError, setInitialDataError] = useState(null);

    const requestTypeOptions = ACADEMIC_REQUEST_TYPES;

    useEffect(() => {
        if (requestType) {
            const selectedTypeObj = ACADEMIC_REQUEST_TYPES.find(t => t.value === requestType);
            if (selectedTypeObj && requestType !== 'OTHER_REQUEST') { setRequestTitle(selectedTypeObj.label); }
            else if (requestType === 'OTHER_REQUEST') { setRequestTitle(''); }
        } else { setRequestTitle(''); }
    }, [requestType]);

    const loadInitialData = useCallback(async () => { /* ... (Giữ nguyên như code đã cung cấp ở câu trả lời trước, đã rà soát) ... */
        if (!isMountedRef.current) return; setIsLoadingLocations(true); setInitialDataError(null); let token;
        try { token = await AsyncStorage.getItem('userToken'); if (!token) { if(isMountedRef.current) navigation.replace('Login'); throw new Error("Token không hợp lệ."); }
            const locRes = await fetch(`${BASE_URL}/api/locations`, { headers: { Authorization: `Bearer ${token}` } }); if (!isMountedRef.current) return; const locResult = await locRes.json();
            if (locRes.ok && (Array.isArray(locResult) || (locResult.success && Array.isArray(locResult.data))) ) { const locs = Array.isArray(locResult) ? locResult : locResult.data; if (isMountedRef.current) setLocationsOptions(locs.map(loc => ({ label: String(loc.name || 'N/A') + (loc.building ? ` (${loc.building})` : ''), value: loc._id })));
            } else { throw new Error(locResult?.message || "Không tải được Cơ sở nhận."); }
        } catch (err) { if (isMountedRef.current) setInitialDataError(err.message || "Lỗi tải Cơ sở nhận."); }
        finally { if (isMountedRef.current) setIsLoadingLocations(false); }
    }, [navigation]);

    useEffect(() => { isMountedRef.current = true; loadInitialData(); return () => { isMountedRef.current = false; }; }, [loadInitialData]);

    const handleSubmit = useCallback(async () => {
        if (!requestType) { Alert.alert('Thông báo', 'Vui lòng chọn Loại yêu cầu.'); return; }
        if (!requestTitle.trim() && requestType === 'OTHER_REQUEST') { Alert.alert('Thông báo', 'Vui lòng nhập Tiêu đề/Tên yêu cầu cho loại "Khác".'); return; }
        if (!studentNotes.trim()) { Alert.alert('Thông báo', 'Vui lòng nhập Nội dung/Ghi chú chi tiết.'); return; }
        // Bỏ yêu cầu bắt buộc cho Nơi nhận kết quả, trừ khi một số type cụ thể cần
        // if (!selectedReceivingCampusId && (requestType === 'XN_SV' || requestType === 'GXN_CTDT' /* ... các type cần nơi nhận ...*/)) {
        //     Alert.alert('Thông báo', 'Vui lòng chọn Nơi nhận kết quả.'); return;
        // }

        if (isMountedRef.current) setIsSubmitting(true); let token;
        try {
            token = await AsyncStorage.getItem('userToken'); if (!token) throw new Error("Phiên làm việc hết hạn.");
            const finalRequestTitle = (requestType === 'OTHER_REQUEST' || !requestTitle) ? (studentNotes.substring(0,50) + (studentNotes.length > 50 ? '...' : '')) : requestTitle.trim(); // Nếu title trống hoặc là OTHER, lấy 50 ký tự đầu của studentNotes

            const dataToSend = {
                requestType: requestType,
                requestTitle: finalRequestTitle, // Sử dụng finalRequestTitle
                studentNotes: studentNotes.trim(),
                receivingCampusId: selectedReceivingCampusId || undefined,
                // quantity: Number(quantity), // Gửi nếu backend cần
            };
            const response = await fetch(`${BASE_URL}/api/academic-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(dataToSend) });
            if (!isMountedRef.current) return; const result = await response.json();
            if (response.ok && result.success) { Alert.alert("Thành công", result.message || "Yêu cầu đã được gửi!"); navigation.goBack(); }
            else { throw new Error(result.message || `Gửi yêu cầu thất bại (Code: ${response.status})`); }
        } catch (err) { if(isMountedRef.current) Alert.alert("Lỗi gửi yêu cầu", err.message || "Không thể gửi."); }
        finally { if(isMountedRef.current) setIsSubmitting(false); }
    }, [navigation, requestType, requestTitle, studentNotes, selectedReceivingCampusId]);

    if (isLoadingLocations && !initialDataError) { return <SafeAreaView style={styles.safeArea}><View style={styles.centeredMessage}><ActivityIndicator size="large" color="#002366" /><Text style={styles.loadingText}>Đang tải...</Text></View></SafeAreaView>; }
    if (initialDataError && !isLoadingLocations) { return ( <SafeAreaView style={styles.safeArea}><View style={styles.centeredMessage}><FontAwesome5 name="exclamation-triangle" size={40} color="#dc3545" style={{marginBottom:15}}/><Text style={styles.errorText}>{initialDataError}</Text><TouchableOpacity onPress={loadInitialData} style={styles.retryButton}><Text style={styles.retryButtonText}>Thử tải lại</Text></TouchableOpacity></View></SafeAreaView> ); }

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardAvoiding} keyboardVerticalOffset={Platform.OS === "ios" ? (navigation.canGoBack() ? 60 : 20) : 0} >
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <Text style={styles.screenTitle}>Tạo Yêu Cầu Học Vụ Mới</Text>

                    <ModalPicker label="Loại yêu cầu" options={requestTypeOptions} selectedValue={requestType} onValueChange={setRequestType} placeholder="-- Chọn loại giấy tờ --" required />
                    {/* Tiêu đề sẽ tự điền hoặc cho phép nhập nếu là 'OTHER_REQUEST' */}
                    <LabeledInput label="Tiêu đề/Tên yêu cầu" value={requestTitle} onChangeText={setRequestTitle} placeholder="Tự động hoặc nhập nếu chọn loại 'Khác'" required editable={requestType === 'OTHER_REQUEST'} />
                    <LabeledInput label="Số lượng" value={quantity} onChangeText={setQuantity} keyboardType="numeric" placeholder="1" required />
                    <LabeledInput label="Thành tiền" value={amountDisplay} editable={false} />
                    <ModalPicker label="Nơi nhận kết quả (Nếu có)" options={locationsOptions} selectedValue={selectedReceivingCampusId} onValueChange={setSelectedReceivingCampusId} placeholder="-- Chọn cơ sở/phòng ban --" isLoading={isLoadingLocations} />
                    <LabeledInput label="Nội dung yêu cầu" value={studentNotes} onChangeText={setStudentNotes} placeholder="Ghi rõ nội dung đề nghị của bạn..." multiline numberOfLines={5} required />
                    {/* Ghi chú này có thể không cần nếu đã gộp vào studentNotes */}
                    {/* <LabeledInput label="Ghi chú" value={notes} onChangeText={setNotes} placeholder="Thêm ghi chú nếu cần..." multiline numberOfLines={3} /> */}

                    <TouchableOpacity style={[styles.submitButton, (isSubmitting || isLoadingLocations) && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={isSubmitting || isLoadingLocations}>
                        {isSubmitting ? (<ActivityIndicator color="#fff" size="small" />) : (<Text style={styles.submitButtonText}>Gửi Yêu Cầu</Text>)}
                    </TouchableOpacity>
                    <View style={{ height: Platform.OS === 'ios' ? 80 : 50 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

// --- StyleSheet (Dựa trên hình ảnh của anh) ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f0f2f5' }, // Màu nền tổng thể
    keyboardAvoiding: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
    screenTitle: { fontSize: 24, fontWeight: 'bold', color: '#002366', textAlign: 'center', marginBottom: 30 }, // Màu xanh HSU
    inputGroup:{ marginBottom: 20 },
    label:{ fontSize: 16, fontWeight: '600', color: '#343a40', marginBottom: 8 }, // Màu chữ label
    requiredStar: { color: '#dc3545'}, // Màu đỏ cho dấu *
    input:{
        backgroundColor: '#f8f9fa', // Màu nền input nhạt hơn
        borderWidth: 1,
        borderColor: '#e0e0e0', // Màu border nhạt
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: Platform.OS === 'ios' ? 14 : 12,
        fontSize: 16,
        color: '#212529',
        minHeight: 50, // Chiều cao tối thiểu
    },
    disabledInput:{ backgroundColor: '#e9ecef', color: '#6c757d' },
    multilineInput:{ paddingTop: 14, minHeight: 100, textAlignVertical: 'top' },
    pickerTrigger:{
        backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8,
        paddingHorizontal: 15, paddingVertical: 14, minHeight: 50,
        flexDirection:'row', justifyContent:'space-between', alignItems:'center'
    },
    pickerTriggerText:{ fontSize: 16, color: '#212529', flex:1, marginRight:5 }, // Màu chữ khi đã chọn
    pickerPlaceholder:{ fontSize: 16, color: '#6c757d' }, // Màu placeholder
    pickerIcon:{ marginLeft: 10, color: '#888' },
    modalOverlay:{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.5)' },
    modalContentContainer:{
        backgroundColor:'#ffffff', // Nền modal trắng
        borderTopLeftRadius:20, borderTopRightRadius:20,
        paddingBottom: Platform.OS === 'ios' ? 35 : 25,
        maxHeight: Platform.OS === 'ios' ? '50%' : '60%', // Tăng chiều cao modal
    },
    modalHeader:{
        flexDirection:'row', justifyContent:'space-between', alignItems:'center',
        paddingVertical:15, paddingHorizontal:20,
        borderBottomWidth:1, borderBottomColor:'#e9ecef'
    },
    modalTitle:{ fontSize:18, fontWeight:'600', color:'#002366' }, // Màu HSU
    modalHeaderButton: {paddingVertical:5, paddingHorizontal: 10}, // Tăng vùng chạm
    modalButtonText:{ fontSize:17, color:'#007aff' }, // Màu xanh dương iOS
    modalButtonDone:{ fontWeight:'bold', color: '#0056b3' }, // Màu HSU đậm hơn
    modalPicker:{ width:'100%', backgroundColor: Platform.OS === 'ios' ? 'transparent':'#ffffff' },
    pickerItemTextIOS:{ color:'#000', fontSize:20, height: Platform.OS === 'ios' ? 180 : undefined }, // Tăng height cho item iOS
    pickerPlaceholderItem:{ color: '#888', fontSize:18 },
    noOptionsContainer: { padding: 20, alignItems: 'center', justifyContent: 'center', height: 150 },
    noOptionsText: { fontSize: 16, color: '#6c757d', fontStyle: 'italic' },
    submitButton:{
        backgroundColor:'#003366', // Màu xanh HSU
        paddingVertical: 16, borderRadius: 8, alignItems:'center', marginTop:25,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2, },
        shadowOpacity: 0.20, shadowRadius: 2.5, elevation: 3,
    },
    submitButtonDisabled:{ backgroundColor:'#adb5bd' },
    submitButtonText:{ color:'#fff', fontSize:17, fontWeight:'600' },
    centeredMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    loadingText: { marginTop:10, color:'#555', fontSize:15 },
    errorText: { color: '#dc3545', fontSize: 16, textAlign: 'center', marginBottom: 10, fontWeight:'500' },
    retryButton: { marginTop: 15, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#0056b3', borderRadius: 5 },
    retryButtonText: { color: '#fff', fontWeight:'bold' },
});

export default AcademicRequestFormScreen;