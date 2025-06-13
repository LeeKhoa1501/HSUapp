// HSUMobileApp/screens/InternshipFormScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,Platform, Alert, ActivityIndicator, Modal, KeyboardAvoidingView} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { API_BASE_URL } from '@env';

const BASE_URL = API_BASE_URL; // <<< ANH NHỚ THAY IP VÀ PORT ĐÚNG >>>

const INTERNSHIP_TYPES = [
    { label: "Thực tập Tốt nghiệp", value: "tot_nghiep" },
    { label: "Thực tập Nhận thức", value: "nhan_thuc" },
    { label: "Kiến tập", value: "kien_tap" },
    { label: "Dự án Doanh nghiệp", value: "du_an_doanh_nghiep" },
    { label: "Khác (Ghi rõ)", value: "other" },
];

const LabeledInput = React.memo(({ label, value, onChangeText, placeholder, keyboardType = 'default', editable = true, multiline = false, numberOfLines = 1, required = false }) => (
  <View style={styles.inputGroup}>
    <Text style={styles.label}>{label}{required && <Text style={styles.requiredStar}> *</Text>}</Text>
    <TextInput
      style={[styles.input, !editable && styles.disabledInput, multiline && styles.multilineInput]}
      value={String(value || '')}
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
        {isLoading ? (<ActivityIndicator size="small" color="#002366" />)
                   : (<Text style={(selectedValue != null && selectedValue !== '') ? styles.pickerTriggerText : styles.pickerPlaceholder} numberOfLines={1}>{displayLabel}</Text>)}
        {!isLoading && <FontAwesome5 name="chevron-down" size={14} color="#6c757d" style={styles.pickerIcon} />}
      </TouchableOpacity>
      <Modal transparent={true} visible={modalVisible} animationType="fade" onRequestClose={handleCancel}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={handleCancel}>
          <TouchableOpacity style={styles.modalContentContainer} activeOpacity={1}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={handleCancel} style={styles.modalHeaderButton}><Text style={styles.modalButtonText}>Hủy</Text></TouchableOpacity>
              <Text style={styles.modalTitle}>{String(label || 'Chọn mục')}</Text>
              <TouchableOpacity onPress={handleDone} style={styles.modalHeaderButton}><Text style={[styles.modalButtonText, styles.modalButtonDone]}>Chọn</Text></TouchableOpacity>
            </View>
            {validOptions.length > 0 ? (
                <Picker selectedValue={tempValue} onValueChange={(itemValue) => setTempValue(itemValue)} style={styles.modalPicker} itemStyle={styles.pickerItemTextIOS}>
                <Picker.Item label={String(placeholder)} value={null} style={styles.pickerPlaceholderItem} />
                {validOptions.map((option, index) => ( <Picker.Item key={String(option.value ?? `opt-${index}`)} label={String(option.label || 'Lựa chọn')} value={option.value} /> ))}
                </Picker>
            ) : (<View style={styles.noOptionsContainer}><Text style={styles.noOptionsText}>Không có lựa chọn nào.</Text></View>)}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
});

const InternshipFormScreen = () => {
    const navigation = useNavigation();
    const isMountedRef = useRef(true);

    const [studentInfo, setStudentInfo] = useState({ studentClass: 'Đang tải...', academicYear: new Date().getFullYear().toString() });
    const [semesterCode, setSemesterCode] = useState(null); // Đây là value từ Picker (ví dụ: 'HK1-2024-2025')
    const [internshipType, setInternshipType] = useState(null);
    const [companiesOptions, setCompaniesOptions] = useState([]);
    const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
    const [selectedCompanyId, setSelectedCompanyId] = useState(null);
    const [companyNameOther, setCompanyNameOther] = useState('');
    const [companyAddressOther, setCompanyAddressOther] = useState('');
    const [companyContactOther, setCompanyContactOther] = useState('');
    const [locationsOptions, setLocationsOptions] = useState([]);
    const [selectedReceivingCampusId, setSelectedReceivingCampusId] = useState(null);
    const [isLoadingLocations, setIsLoadingLocations] = useState(true);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [initialDataError, setInitialDataError] = useState(null);

    const currentYear = new Date().getFullYear();
    const SEMESTER_OPTIONS = [
        { label: `Học kỳ 1 (${currentYear}-${currentYear + 1})`, value: `HK1-${currentYear}-${currentYear+1}`, realSemesterCode: `${String(currentYear).slice(-2)}${String(currentYear+1).slice(-2)}1`, academicYear: `${currentYear}-${currentYear + 1}` },
        { label: `Học kỳ 2 (${currentYear}-${currentYear + 1})`, value: `HK2-${currentYear}-${currentYear+1}`, realSemesterCode: `${String(currentYear).slice(-2)}${String(currentYear+1).slice(-2)}2`, academicYear: `${currentYear}-${currentYear + 1}` },
        { label: `Học kỳ Hè (${currentYear}-${currentYear + 1})`, value: `HKH-${currentYear}-${currentYear+1}`, realSemesterCode: `${String(currentYear).slice(-2)}${String(currentYear+1).slice(-2)}3`, academicYear: `${currentYear}-${currentYear + 1}` },
        { label: `Học kỳ 1 (${currentYear + 1}-${currentYear + 2})`, value: `HK1-${currentYear+1}-${currentYear+2}`, realSemesterCode: `${String(currentYear+1).slice(-2)}${String(currentYear+2).slice(-2)}1`, academicYear: `${currentYear + 1}-${currentYear + 2}` },
    ];

    const loadInitialData = useCallback(async () => {
        if (!isMountedRef.current) return;
        setIsLoadingLocations(true); setIsLoadingCompanies(true); setInitialDataError(null);
        let token;
        try {
            token = await AsyncStorage.getItem('userToken');
            if (!token) { if(isMountedRef.current) navigation.replace('Login'); throw new Error("Token không hợp lệ."); }
            const [userRes, locRes, compRes] = await Promise.all([
                fetch(`${BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${BASE_URL}/api/locations`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${BASE_URL}/api/companies`, { headers: { Authorization: `Bearer ${token}` } })]);
            if (!isMountedRef.current) return;
            const userData = await userRes.json();
            if (userRes.ok && userData.success && userData.data) { if(isMountedRef.current) setStudentInfo(prev => ({ ...prev, studentClass: userData.data.studentClass || 'Chưa có' }));
            } else { console.warn("[InternForm] Không tải được thông tin SV:", userData.message); }
            const locationsData = await locRes.json();
            if (locRes.ok && (Array.isArray(locationsData) || (locationsData.success && Array.isArray(locationsData.data))) ) {
                const locs = Array.isArray(locationsData) ? locationsData : locationsData.data;
                if (isMountedRef.current) setLocationsOptions(locs.map(loc => ({ label: String(loc.name || 'N/A') + (loc.building ? ` (${loc.building})` : ''), value: loc._id })));
            } else { throw new Error(locationsData?.message || "Không tải được Cơ sở nhận."); }
            const companiesData = await compRes.json();
            if (compRes.ok && companiesData.success && Array.isArray(companiesData.data)) {
                if (isMountedRef.current) setCompaniesOptions(companiesData.data.map(c => ({ label: String(c.name || 'N/A'), value: c._id })));
            } else { throw new Error(companiesData?.message || "Không tải được Công ty."); }
        } catch (err) { if (isMountedRef.current) setInitialDataError(err.message || "Lỗi tải dữ liệu form."); }
        finally { if (isMountedRef.current) { setIsLoadingLocations(false); setIsLoadingCompanies(false); } }
    }, [navigation]);

    useEffect(() => { isMountedRef.current = true; loadInitialData(); return () => { isMountedRef.current = false; }; }, [loadInitialData]);
    const handleCompanySelection = (companyIdValue) => { setSelectedCompanyId(companyIdValue); if (companyIdValue) { setCompanyNameOther(''); setCompanyAddressOther(''); setCompanyContactOther('');} };

    const handleSubmit = useCallback(async () => {
        if (!studentInfo.studentClass || studentInfo.studentClass === 'N/A' || studentInfo.studentClass === 'Đang tải...') { Alert.alert('Thông báo', 'Thông tin Lớp/Ngành của bạn chưa sẵn sàng.'); return; }
        if (!semesterCode) { Alert.alert('Thông báo', 'Vui lòng chọn Học kỳ đăng ký.'); return; }
        if (!internshipType) { Alert.alert('Thông báo', 'Vui lòng chọn Loại hình thực tập.'); return; }
        if (!selectedCompanyId && !companyNameOther.trim()) { Alert.alert('Thông báo', 'Vui lòng chọn Doanh nghiệp hoặc nhập tên Doanh nghiệp mới.'); return; }
        if (selectedCompanyId && companyNameOther.trim()) { Alert.alert('Lưu ý', 'Đã chọn DN từ danh sách, không nhập DN khác.'); return; }
        if (!selectedReceivingCampusId) { Alert.alert('Thông báo', 'Vui lòng chọn Nơi nhận đơn.'); return; }

        if (isMountedRef.current) setIsSubmitting(true);
        let token;
        try {
            token = await AsyncStorage.getItem('userToken'); if (!token) throw new Error("Phiên làm việc hết hạn.");

            const selectedSemesterObj = SEMESTER_OPTIONS.find(s => s.value === semesterCode);
            const academicYearToSend = selectedSemesterObj ? selectedSemesterObj.academicYear : studentInfo.academicYear; // academicYear từ selection
            // Lấy mã học kỳ thật sự (ví dụ: "2411") để gửi lên backend
            const semesterCodeForBackend = selectedSemesterObj ? selectedSemesterObj.realSemesterCode : null;

            if (!academicYearToSend || !semesterCodeForBackend) {
                 Alert.alert('Lỗi dữ liệu', 'Không xác định được Học kỳ hoặc Năm học. Vui lòng chọn lại học kỳ.');
                 if (isMountedRef.current) setIsSubmitting(false);
                 return;
            }

            const dataToSend = {
                studentClass: studentInfo.studentClass,
                semester: semesterCodeForBackend, // <<< GỬI `semester` với giá trị là mã học kỳ thật
                academicYear: academicYearToSend,
                internshipType,
                companyId: selectedCompanyId || undefined,
                companyNameOther: selectedCompanyId ? undefined : companyNameOther.trim(),
                companyAddressOther: selectedCompanyId ? undefined : companyAddressOther.trim(),
                companyContactOther: selectedCompanyId ? undefined : companyContactOther.trim(),
                receivingCampusId: selectedReceivingCampusId,
                notes: notes.trim(),
                // startDate, endDate nếu có
            };
            console.log("[InternshipForm] Dữ liệu gửi đi:", JSON.stringify(dataToSend, null, 2));

            const response = await fetch(`${BASE_URL}/api/internships`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(dataToSend) });
            if (!isMountedRef.current) return;
            const result = await response.json();
            if (response.ok && result.success) {
                Alert.alert("Thành công", result.message || "Yêu cầu thực tập của bạn đã được gửi thành công!");
                navigation.goBack();
            } else { throw new Error(result.message || `Gửi yêu cầu thất bại (Code: ${response.status})`); }
        } catch (err) {
            console.error("[InternshipForm] Lỗi khi gửi đơn:", err.message); // Log lỗi đầy đủ
            if(isMountedRef.current) Alert.alert("Lỗi gửi đơn", err.message || "Không thể gửi yêu cầu. Vui lòng thử lại sau.");
        } finally {
            if(isMountedRef.current) setIsSubmitting(false);
        }
    }, [navigation, studentInfo, semesterCode, internshipType, selectedCompanyId, companyNameOther, companyAddressOther, companyContactOther, selectedReceivingCampusId, notes, SEMESTER_OPTIONS]);


    if (isLoadingCompanies || isLoadingLocations && !initialDataError) {
        return <SafeAreaView style={styles.safeArea}><View style={styles.centeredMessage}><ActivityIndicator size="large" color="#002366" /><Text style={styles.loadingText}>Đang tải dữ liệu form...</Text></View></SafeAreaView>;
    }
    if (initialDataError) {
        return ( <SafeAreaView style={styles.safeArea}><View style={styles.centeredMessage}><FontAwesome5 name="exclamation-triangle" size={40} color="#dc3545" style={{marginBottom:15}}/><Text style={styles.errorText}>{initialDataError}</Text><TouchableOpacity onPress={loadInitialData} style={styles.retryButton}><Text style={styles.retryButtonText}>Thử tải lại</Text></TouchableOpacity></View></SafeAreaView> );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardAvoiding} keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0} >
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    <Text style={styles.screenTitle}>Tạo Đơn Xin Thực Tập</Text>
                    <LabeledInput label="Lớp/Ngành (Hệ thống)" value={studentInfo.studentClass || ''} editable={false} />
                    <ModalPicker label="Học kỳ đăng ký" options={SEMESTER_OPTIONS} selectedValue={semesterCode} onValueChange={setSemesterCode} placeholder="-- Chọn học kỳ --" required />
                    <ModalPicker label="Loại hình thực tập" options={INTERNSHIP_TYPES} selectedValue={internshipType} onValueChange={setInternshipType} placeholder="-- Chọn loại hình --" required />
                    <View style={styles.inputGroup}><Text style={styles.label}>Doanh nghiệp thực tập <Text style={styles.requiredStar}>*</Text></Text><ModalPicker label="Chọn Doanh Nghiệp" options={companiesOptions} selectedValue={selectedCompanyId} onValueChange={handleCompanySelection} placeholder="-- Chọn từ danh sách công ty --" isLoading={isLoadingCompanies} /></View>
                    <LabeledInput label="Hoặc nhập Tên Doanh nghiệp mới" value={companyNameOther} onChangeText={setCompanyNameOther} placeholder="(Nếu không có trong danh sách trên)" editable={!selectedCompanyId} />
                    <LabeledInput label="Địa chỉ công ty (nếu nhập mới)" value={companyAddressOther} onChangeText={setCompanyAddressOther} placeholder="Số nhà, đường, phường/xã..." editable={!selectedCompanyId} />
                    <LabeledInput label="Thông tin liên hệ công ty (nếu nhập mới)" value={companyContactOther} onChangeText={setCompanyContactOther} placeholder="Người liên hệ, SĐT, Email..." editable={!selectedCompanyId} />
                    <ModalPicker label="Nơi nhận đơn (Phòng ban Trường)" options={locationsOptions} selectedValue={selectedReceivingCampusId} onValueChange={setSelectedReceivingCampusId} placeholder="-- Chọn nơi nhận đơn --" isLoading={isLoadingLocations} required />
                    <LabeledInput label="Ghi chú thêm" value={notes} onChangeText={setNotes} placeholder="Ví dụ: Xin thư giới thiệu..." multiline numberOfLines={4} />
                    <TouchableOpacity style={[styles.submitButton, (isSubmitting || isLoadingCompanies || isLoadingLocations) && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={isSubmitting || isLoadingCompanies || isLoadingLocations}>
                        {isSubmitting ? (<ActivityIndicator color="#fff" size="small" />) : (<Text style={styles.submitButtonText}>Gửi Yêu Cầu</Text>)}
                    </TouchableOpacity>
                    <View style={{ height: Platform.OS === 'ios' ? 80 : 50 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f0f2f5' },
    keyboardAvoiding: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 40, flexGrow: 1 },
    screenTitle: { fontSize: 20, fontWeight: 'bold', color: '#003366', textAlign: 'center', marginBottom: 25 },
    inputGroup:{marginBottom:20},
    label:{fontSize:15,fontWeight:'600',color:'#495057',marginBottom:8},
    input:{backgroundColor:'#fff',borderWidth:1,borderColor:'#dee2e6',borderRadius:8,paddingHorizontal:14,paddingVertical:Platform.OS==='ios'?12:10,fontSize:15,color:'#212529', minHeight: 48},
    disabledInput:{backgroundColor:'#e9ecef',color:'#6c757d'},
    multilineInput:{paddingTop:12, textAlignVertical: 'top'},
    pickerTrigger:{backgroundColor:'#fff',borderWidth:1,borderColor:'#dee2e6',borderRadius:8,paddingHorizontal:14,paddingVertical:12,minHeight:48,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
    pickerTriggerText:{fontSize:15,color:'#212529'},
    pickerPlaceholder:{fontSize:15,color:'#adb5bd'},
    pickerIcon:{marginLeft: 5},
    modalOverlay:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.4)'},
    modalContentContainer:{backgroundColor:'#f8f9fa',borderTopLeftRadius:15,borderTopRightRadius:15,paddingBottom: Platform.OS === 'ios' ? 30 : 20, maxHeight: '60%'},
    modalHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:12,paddingHorizontal:16,borderBottomWidth:1,borderBottomColor:'#dee2e6'},
    modalTitle:{fontSize:16,fontWeight:'600',color:'#495057'},
    modalButtonText:{fontSize:16,color:'#007bff'},
    modalButtonDone:{fontWeight:'bold'},
    modalPicker:{width:'100%',backgroundColor:Platform.OS==='ios'?'#f8f9fa':undefined},
    pickerItemTextIOS:{color:'#000',fontSize:17},
    pickerPlaceholderItem:{ color: '#adb5bd'},
    submitButton:{backgroundColor:'#002366',paddingVertical:15,borderRadius:10,alignItems:'center',marginTop:15},
    submitButtonDisabled:{backgroundColor:'#adb5bd'},
    submitButtonText:{color:'#fff',fontSize:16,fontWeight:'bold'},
    centeredMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    errorText: { color: 'red', fontSize: 16, textAlign: 'center', marginBottom: 10 },
    submitErrorText: { color: 'red', textAlign: 'center', marginBottom: 15, marginTop: -5 },
    retryButton: { marginTop: 10, paddingHorizontal: 15, paddingVertical: 8, backgroundColor: '#007bff', borderRadius: 5 },
    retryButtonText: { color: '#fff' },
    searchInput: { // Style cho ô tìm kiếm doanh nghiệp (nếu cần)
        backgroundColor: '#fff', borderWidth: 1, borderColor: '#dee2e6', borderRadius: 8,
        paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 10 : 8, fontSize: 15,
        marginBottom: 10, // Khoảng cách với Picker chọn từ danh sách
    }
});
export default InternshipFormScreen;