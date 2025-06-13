// HSUMobileApp/screens/HomeScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Alert, ScrollView, RefreshControl, Dimensions, Image, ActivityIndicator, Linking, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, parseISO } from 'date-fns';
import vi from 'date-fns/locale/vi';

// --- ASSETS & DATA ---
import homeData from '../assets/data/homeData.json'; // Đảm bảo đường dẫn này đúng

// --- COMPONENTS ---
import HomeScreenHeader from './components/HomeScreenHeader';
import FavoriteFunctions from './components/FavoriteFunctions';
import TodayTimetableCard from './components/TodayTimetableCard';

// --- CONSTANTS & CONFIG ---
const BASE_URL = 'http://10.101.39.47:5000'; // URL Backend Server (Khoa thay bằng IP và Port đúng)
const screenWidth = Dimensions.get('window').width;

// Tính toán kích thước cho các item trong nhóm chức năng (ví dụ: "Thông tin học vụ")
const MAX_WEB_FUNCTION_ITEM_WIDTH = 90;       // Chiều rộng tối đa của một item chức năng trên web
const HORIZONTAL_PADDING_SECTION_CARD = 20; // Padding ngang của card chứa các item (ví dụ: functionSectionCard)
const ITEM_MARGIN_RIGHT_IN_GROUP = 10;        // Margin phải của mỗi item trong nhóm
const ITEMS_PER_ROW_CONFIG = 4;               // Số item mong muốn trên một hàng (dùng để tính toán)

// Tính toán chiều rộng cơ bản của một item chức năng
const calculatedFunctionItemWidth = (screenWidth - 2 * HORIZONTAL_PADDING_SECTION_CARD - (ITEMS_PER_ROW_CONFIG - 1) * ITEM_MARGIN_RIGHT_IN_GROUP) / ITEMS_PER_ROW_CONFIG;

// Áp dụng chiều rộng cuối cùng cho item, có giới hạn cho web
const functionItemWidth = Platform.OS === 'web'
    ? Math.min(calculatedFunctionItemWidth, MAX_WEB_FUNCTION_ITEM_WIDTH)
    : calculatedFunctionItemWidth;

// --- MAIN COMPONENT: HomeScreen ---
const HomeScreen = () => {
    // --- NAVIGATION ---
    const navigation = useNavigation();

    // --- STATE MANAGEMENT ---
    const [userInfo, setUserInfo] = useState(null);
    const [userToken, setUserToken] = useState(null);
    const [allAppFunctions, setAllAppFunctions] = useState([]);
    const [favoriteFunctionIds, setFavoriteFunctionIds] = useState([]);
    const [groupedFunctions, setGroupedFunctions] = useState({});
    const [todayTimetable, setTodayTimetable] = useState([]);
    const [isLoadingTimetable, setIsLoadingTimetable] = useState(true);
    const [timetableError, setTimetableError] = useState(null);
    const [attendedEvents, setAttendedEvents] = useState([]);
    const [isLoadingAttendedEvents, setIsLoadingAttendedEvents] = useState(true);
    const [attendedEventsError, setAttendedEventsError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    // --- LIFECYCLE & DATA FETCHING ---
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    const loadAuthData = useCallback(async () => {
        if (!isMountedRef.current) return;
        try {
          const token = await AsyncStorage.getItem('userToken');
          if (!isMountedRef.current) return;
          if (token) {
            setUserToken(token);
            const response = await fetch(`${BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
            if (!isMountedRef.current) return;
            const userData = await response.json();
            if (response.ok && userData.success) {
              if (isMountedRef.current) setUserInfo(userData.data);
            } else {
              await AsyncStorage.removeItem('userToken');
              if (isMountedRef.current) navigation.replace('Login');
            }
          } else {
            if (isMountedRef.current) navigation.replace('Login');
          }
        } catch (e) {
          await AsyncStorage.removeItem('userToken');
          if (isMountedRef.current) navigation.replace('Login');
        }
    }, [navigation]);

    const fetchTodayTimetable = useCallback(async () => {
        if (!userToken || !isMountedRef.current) {
          if (isMountedRef.current) setIsLoadingTimetable(false); return;
        }
        if (isMountedRef.current) { setIsLoadingTimetable(true); setTimetableError(null); }
        try {
          const response = await fetch(`${BASE_URL}/api/timetable/today`, { headers: { Authorization: `Bearer ${userToken}` } });
          if (!isMountedRef.current) return;
          const responseText = await response.text();
          if (!isMountedRef.current) return;
          if (!response.ok) throw new Error(`Lỗi ${response.status} khi tải lịch học.`);
          const result = JSON.parse(responseText);
          if (result.success && Array.isArray(result.data)) {
            if (isMountedRef.current) setTodayTimetable(result.data);
          } else { throw new Error(result.message || "Dữ liệu lịch học không hợp lệ."); }
        } catch (e) {
          if (isMountedRef.current) setTimetableError(e.message);
        } finally { if (isMountedRef.current) setIsLoadingTimetable(false); }
    }, [userToken]);

    const loadFavoriteFunctionIds = useCallback(async () => {
        if (!isMountedRef.current) return;
        try {
          const storedFavorites = await AsyncStorage.getItem('favoriteFunctionIds');
          let idsToSet = [16, 5, 4, 6]; // Khoa kiểm tra lại ID này cho đúng với homeData.json
          if (storedFavorites) {
            const parsedIds = JSON.parse(storedFavorites);
            if (Array.isArray(parsedIds) && parsedIds.length > 0) idsToSet = parsedIds;
          }
          if (isMountedRef.current) setFavoriteFunctionIds(idsToSet);
        } catch (e) {
          if (isMountedRef.current) setFavoriteFunctionIds([16, 5, 4, 6]); // Fallback
        }
    }, []);

    const fetchAttendedEventsSummary = useCallback(async () => {
        if (!isMountedRef.current) { setIsLoadingAttendedEvents(false); return; }
        if (isMountedRef.current) { setIsLoadingAttendedEvents(true); setAttendedEventsError(null); }
        try {
          const response = await fetch(`${BASE_URL}/api/events/summary/attended-demo`);
          if (!isMountedRef.current) return;
          const result = await response.json();
          if (response.ok && result.success && Array.isArray(result.data)) {
            if (isMountedRef.current) setAttendedEvents(result.data);
          } else { throw new Error(result.message || "Không thể tải tóm tắt sự kiện."); }
        } catch (e) {
          if (isMountedRef.current) setAttendedEventsError(e.message);
        } finally {
          if (isMountedRef.current) setIsLoadingAttendedEvents(false);
        }
    }, []);

    useEffect(() => {
        setAllAppFunctions(homeData.functions);
        // Khoa kiểm tra lại ID chức năng cho đúng với homeData.json của Khoa
        const mainAcademicFunctions = homeData.functions.filter(f => [1, 2, 3, 4, 5, 6, 7, 10, 16, 17, 18].includes(f.id));
        const surveyServiceFunctions = homeData.functions.filter(f => [8, 9, 11, 12, 14, 15].includes(f.id));
        if (isMountedRef.current) {
            setGroupedFunctions({
                'Thông tin học vụ': mainAcademicFunctions,
                'Khảo sát & Dịch vụ': surveyServiceFunctions,
            });
        }
        loadAuthData();
        loadFavoriteFunctionIds();
        fetchAttendedEventsSummary();
    }, [loadAuthData, loadFavoriteFunctionIds, fetchAttendedEventsSummary]);

    useEffect(() => {
        if (userToken && isMountedRef.current) {
            fetchTodayTimetable();
        }
    }, [userToken, fetchTodayTimetable]);

    useFocusEffect(useCallback(() => { loadFavoriteFunctionIds(); }, [loadFavoriteFunctionIds]));

    // --- MEMOIZED VALUES ---
    const actualFavoriteFunctions = React.useMemo(() => {
        if (!allAppFunctions.length || !favoriteFunctionIds.length) return [];
        return favoriteFunctionIds
            .map(id => allAppFunctions.find(func => func.id === id))
            .filter(func => func !== undefined);
    }, [allAppFunctions, favoriteFunctionIds]);

    // --- EVENT HANDLERS ---
    const handleFunctionPress = useCallback((item) => {
        if (item.screenName && typeof item.screenName === 'string' && item.screenName.trim() !== "") {
            navigation.navigate(item.screenName);
        } else {
            Alert.alert(item.name, "Chức năng này đang được phát triển và sẽ sớm có trong các phiên bản tới. Mong bạn thông cảm!");
        }
    }, [navigation]);

    const onRefresh = useCallback(async () => {
        if (!isMountedRef.current) return;
        setRefreshing(true);
        await loadAuthData();
        if (userToken && isMountedRef.current) {
            await Promise.all([ // Chạy song song để tăng tốc
                fetchTodayTimetable(),
                fetchAttendedEventsSummary()
            ]);
        }
        await loadFavoriteFunctionIds();
        if (isMountedRef.current) setRefreshing(false);
    }, [loadAuthData, userToken, fetchTodayTimetable, loadFavoriteFunctionIds, fetchAttendedEventsSummary]);

    // --- RENDER FUNCTIONS ---
    const renderFunctionGroupItem = ({ item }) => {
        const iconContainerSizeRatio = 0.65;
        const iconSizeRatio = 0.35;
        const maxWebIconContainerSize = 45;
        const maxWebIconSize = 22;

        const iconContainerActualSize = Platform.OS === 'web'
            ? Math.min(functionItemWidth * iconContainerSizeRatio, maxWebIconContainerSize)
            : functionItemWidth * iconContainerSizeRatio;

        const iconActualSize = Platform.OS === 'web'
            ? Math.min(functionItemWidth * iconSizeRatio, maxWebIconSize)
            : functionItemWidth * iconSizeRatio;

        return (
            <TouchableOpacity
                style={[
                    styles.functionGroupItem,
                    {
                        width: functionItemWidth, // Áp dụng width đã tính toán
                        flexShrink: 0,          // Ngăn item bị co lại trên iOS
                    }
                ]}
                onPress={() => handleFunctionPress(item)}
            >
                <View style={[
                    styles.functionGroupIconContainer,
                    { width: iconContainerActualSize, height: iconContainerActualSize }
                ]}>
                    <FontAwesome5 name={item.icon} size={iconActualSize} color={item.iconColor || "#003366"} />
                </View>
                <Text style={styles.functionGroupText} numberOfLines={2}>{item.name}</Text>
            </TouchableOpacity>
        );
    };

    const formatEventDateCard = (dateStr) => {
        try { return format(parseISO(dateStr), 'dd/MM', { locale: vi }); }
        catch (e) { return 'N/A'; }
    };

    // --- MAIN RENDER ---
    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                style={styles.container}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={["#002366"]}
                        tintColor={"#002366"}
                    />
                }
                contentContainerStyle={{ paddingBottom: 20 }}
            >
                <HomeScreenHeader
                    studentName={userInfo?.fullName || 'Sinh viên'}
                    studentMSSV={userInfo?.studentId}
                    avatarUrl={userInfo?.avatarUrl}
                    onAvatarPress={() => navigation.navigate('AccountSettings')}
                />

                {actualFavoriteFunctions.length > 0 && (
                    <View style={styles.favoriteSectionContainerStyle}>
                        <View style={styles.favoriteHeaderStyle}>
                            <Text style={[styles.sectionTitle, { marginRight: 8 }]}>Yêu Thích</Text>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('EditFavoriteFunctions', {
                                    allFunctions: allAppFunctions,
                                    currentFavoriteIds: favoriteFunctionIds,
                                })}
                                style={styles.editFavoritesButton}
                            >
                                <FontAwesome5 name="sliders-h" size={18} color="#0056b3" />
                            </TouchableOpacity>
                            <View style={{ flex: 1 }} />
                        </View>
                        <FavoriteFunctions functions={actualFavoriteFunctions} onFunctionPress={handleFunctionPress} />
                    </View>
                )}

                <TodayTimetableCard
                    title="Lịch học Hôm nay"
                    entries={todayTimetable}
                    isLoading={isLoadingTimetable}
                    error={timetableError}
                    onSeeAllPress={() => navigation.navigate('Timetable')}
                    onEntryPress={(entry) => Alert.alert(entry.courseName || "Chi tiết", `Phòng: ${entry.room || 'N/A'}\nTG: ${entry.startTime} - ${entry.endTime}`)}
                />

                {/* Các Nhóm Chức năng khác */}
                {Object.keys(groupedFunctions).map((sectionTitle) => (
                    groupedFunctions[sectionTitle] && groupedFunctions[sectionTitle].length > 0 &&
                    sectionTitle !== 'Sự kiện & Khác' && (
                        <View key={sectionTitle} style={styles.functionSectionCard}>
                            <View style={styles.functionSectionHeader}>
                                <Text style={styles.sectionTitle}>{sectionTitle}</Text>
                            </View>
                            <FlatList
                                data={groupedFunctions[sectionTitle]}
                                keyExtractor={(item) => item.id.toString()}
                                renderItem={renderFunctionGroupItem}
                                horizontal={true}
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.horizontalListContainer}
                            />
                        </View>
                    )
                ))}

                {/* Card Sự kiện Đã Tham Gia */}
                <View style={styles.generalCardContainer}>
                    <View style={styles.attendedEventsHeader}>
                        <Text style={styles.sectionTitle}>Sự kiện đã diễn ra</Text>
                        {attendedEvents.length > 0 &&
                            <TouchableOpacity onPress={() => navigation.navigate('AllUserAttendedEventsScreen')}>
                                <Text style={styles.seeAllText}>Xem tất cả</Text>
                            </TouchableOpacity>
                        }
                    </View>

                    {isLoadingAttendedEvents ? (
                        <ActivityIndicator size="small" color="#002366" style={{ marginVertical: 30, alignSelf: 'center' }} />
                    ) : attendedEventsError ? (
                        <Text style={styles.attendedEventErrorText}>Lỗi tải sự kiện: {attendedEventsError.substring(0, 100)}...</Text>
                    ) : attendedEvents && attendedEvents.length > 0 ? (
                        <FlatList
                            horizontal
                            data={attendedEvents}
                            keyExtractor={(item) => item._id ? item._id.toString() : Math.random().toString()}
                            showsHorizontalScrollIndicator={false}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.attendedEventItem}
                                    onPress={() => {
                                        if (item.originalUrl) Linking.openURL(item.originalUrl).catch(err => Alert.alert("Lỗi", "Không thể mở liên kết này."));
                                        else Alert.alert(item.eventName, item.shortDescription || "Chưa có mô tả chi tiết.");
                                    }}
                                >
                                    <Image source={{ uri: item.imageUrl || 'https://via.placeholder.com/200x120.png?text=HSU+Event' }} style={styles.attendedEventImage} />
                                    <View style={styles.attendedEventInfoOverlay}>
                                        <Text style={styles.attendedEventName} numberOfLines={2}>{item.eventName}</Text>
                                        <Text style={styles.attendedEventDate}>Ngày: {formatEventDateCard(item.startDate)}</Text>
                                    </View>
                                    {item.status === 'Đã kết thúc' && (
                                        <View style={styles.attendedBadge}>
                                            <Text style={styles.attendedBadgeText}>Đã tham gia</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            )}
                            contentContainerStyle={{ paddingVertical: 10, paddingLeft: HORIZONTAL_PADDING_SECTION_CARD / 2 }}
                        />
                    ) : (
                        <View style={styles.noAttendedEventsContainer}>
                            <FontAwesome5 name="calendar-check" size={40} color="#bdc3c7" style={{ marginBottom: 10 }} />
                            <Text style={styles.comingSoonText}>Bạn chưa tham gia sự kiện nào.</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Event')}>
                                <Text style={styles.exploreEventsText}>Khám phá sự kiện mới!</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

            </ScrollView>
        </SafeAreaView>
    );
};

// --- STYLESHEET ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#EBF2F5' },
    container: { flex: 1 },
    favoriteSectionContainerStyle: {
        // marginBottom: 10, // Ví dụ
    },
    favoriteHeaderStyle: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: HORIZONTAL_PADDING_SECTION_CARD,
        marginTop: 20,
    },
    editFavoritesButton: { padding: 8 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#002366' },
    generalCardContainer: {
        backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 15,
        paddingTop: 15, paddingBottom: 10, marginHorizontal: HORIZONTAL_PADDING_SECTION_CARD,
        marginTop: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08, shadowRadius: 5, elevation: 3,
    },
    comingSoonText: { textAlign: 'center', color: '#6c757d', paddingVertical: 10, fontStyle: 'italic', fontSize: 14 },
    exploreEventsText: { marginTop: 10, color: '#007bff', fontWeight: 'bold', fontSize: 15, textAlign: 'center', padding: 5 },
    attendedEventsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    seeAllText: { fontSize: 14, color: '#007bff', fontWeight: '500' },
    attendedEventItem: {
        width: Platform.OS === 'web' ? 280 : screenWidth * 0.6,
        height: Platform.OS === 'web' ? 170 : screenWidth * 0.38,
        maxWidth: Platform.OS === 'web' ? 320 : undefined,
        marginRight: 12, borderRadius: 8, backgroundColor: '#e9ecef',
        elevation: Platform.OS === 'web' ? 0 : 2, shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 }, shadowOpacity: Platform.OS === 'web' ? 0.1 : 0.15,
        shadowRadius: Platform.OS === 'web' ? 2 : 2.5,
        ...(Platform.OS === 'web' && { borderWidth: 1, borderColor: '#ddd' }),
        overflow: 'hidden',
    },
    attendedEventImage: { width: '100%', height: '100%', borderRadius: 8, position: 'absolute' },
    attendedEventInfoOverlay: {
        flex: 1, backgroundColor: 'rgba(0, 35, 102, 0.4)', padding: 10,
        justifyContent: 'flex-end', borderRadius: 8,
    },
    attendedEventName: { fontSize: Platform.OS === 'web' ? 14 : 13, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 3 },
    attendedEventDate: { fontSize: Platform.OS === 'web' ? 12 : 11, color: '#E0E0E0' },
    attendedBadge: {
        position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4,
    },
    attendedBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
    noAttendedEventsContainer: { alignItems: 'center', paddingVertical: 15 },
    attendedEventErrorText: { textAlign: 'center', color: '#c0392b', paddingVertical: 15, fontSize: 13 },
    functionSectionCard: {
        backgroundColor: '#ffffff', borderRadius: 12, marginTop: 20,
        marginHorizontal: HORIZONTAL_PADDING_SECTION_CARD, shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06,
        shadowRadius: 4, elevation: 2, paddingTop: 15, paddingBottom: 10,
    },
    functionSectionHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', paddingHorizontal: 15, marginBottom: 10,
    },
    horizontalListContainer: {
        paddingLeft: 15,
        paddingRight: 5, // Để item cuối không sát viền phải của card
    },
    functionGroupItem: {
        // width sẽ được set inline trong renderFunctionGroupItem
        alignItems: 'center',
        justifyContent: 'flex-start', // Căn icon và text từ trên xuống
        marginRight: ITEM_MARGIN_RIGHT_IN_GROUP,
        marginBottom: 10,
        // flexShrink: 0 đã được thêm inline trong renderFunctionGroupItem
    },
    functionGroupIconContainer: {
        // width và height sẽ được set inline trong renderFunctionGroupItem
        borderRadius: 12,
        backgroundColor: '#F0F5FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    functionGroupText: {
        textAlign: 'center',
        fontSize: Platform.OS === 'web' ? 12 : 11,
        color: '#34495e',
        lineHeight: 14,
        fontWeight: '500',
        height: 28, // Cho 2 dòng text, giúp các item đều nhau hơn về chiều cao tổng thể
    },
});

export default HomeScreen;