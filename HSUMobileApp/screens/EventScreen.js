// HSUMobileApp/screens/EventScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, Image,
    TouchableOpacity, ActivityIndicator, RefreshControl, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { API_BASE_URL } from '@env';
import { useNavigation } from '@react-navigation/native';
import { format, parseISO } from 'date-fns'; // Import parseISO để xử lý chuỗi ngày từ server
import vi from 'date-fns/locale/vi';     // Tiếng Việt cho date-fns

//  IP VÀ PORT ĐÚNG CỦA BACKEND, HOẶC IMPORT TỪ CONFIG FILE
const BASE_URL = API_BASE_URL;

const EventScreen = () => {
    const navigation = useNavigation();
    const [events, setEvents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    // Pagination states (nếu cần phát triển sau)
    // const [page, setPage] = useState(1);
    // const [totalPages, setTotalPages] = useState(1);
    // const [isLoadingMore, setIsLoadingMore] = useState(false);

    const fetchEvents = useCallback(async (isRefreshing = false /*, loadMore = false */) => {
        // if (loadMore) setIsLoadingMore(true);
        if (!isRefreshing /* && !loadMore */) setIsLoading(true);
        setError(null);

        // const pageToFetch = loadMore ? page + 1 : 1;

        try {
            // Lấy các sự kiện "Sắp diễn ra" hoặc "Đang diễn ra"
            // Thêm "&status=Đang diễn ra" nếu muốn lấy cả sự kiện đang diễn ra
            const response = await fetch(`${BASE_URL}/api/events?status=Sắp diễn ra&status=Đang diễn ra&pageSize=20`); // Lấy nhiều hơn để scroll
            const result = await response.json();

            if (response.ok && result.events) {
                // if (loadMore) {
                //     setEvents(prevEvents => [...prevEvents, ...result.events]);
                // } else {
                setEvents(result.events);
                // }
                // setPage(result.page);
                // setTotalPages(result.pages);
            } else {
                throw new Error(result.message || 'Không thể tải danh sách sự kiện.');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            if (!isRefreshing /* && !loadMore */) setIsLoading(false);
            if (isRefreshing) setRefreshing(false);
            // if (loadMore) setIsLoadingMore(false);
        }
    }, [/* page */]); // Bỏ page nếu chưa làm pagination

    useEffect(() => {
        // Đặt title cho header của màn hình này (nếu nó là 1 screen trong StackNavigator của Tab)
        // Hoặc nếu nó chỉ là component của Tab.Screen thì title sẽ được set ở Tab.Navigator
        navigation.setOptions({ title: 'Sự kiện nổi bật' });
        fetchEvents();
    }, [fetchEvents, navigation]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchEvents(true);
    };

    // const handleLoadMore = () => {
    //     if (!isLoadingMore && page < totalPages) {
    //         fetchEvents(false, true);
    //     }
    // };

    // Hàm format ngày tháng cho đẹp và thân thiện
    const formatDateRange = (startDateStr, endDateStr, timeStr) => {
        try {
            const start = parseISO(startDateStr); // Chuyển chuỗi ISO từ server thành Date object
            let dateDisplay = format(start, 'EEEE, dd/MM/yyyy', { locale: vi }); // Ví dụ: "Thứ Hai, 20/05/2024"

            if (endDateStr) {
                const end = parseISO(endDateStr);
                // Chỉ hiển thị ngày kết thúc nếu khác ngày bắt đầu
                if (format(start, 'yyyyMMdd') !== format(end, 'yyyyMMdd')) {
                    dateDisplay += ` - ${format(end, 'dd/MM/yyyy', { locale: vi })}`;
                }
            }
            return timeStr ? `${dateDisplay}\n${timeStr}` : dateDisplay;
        } catch (e) {
            console.error("Error formatting date:", e);
            return timeStr || 'N/A'; // Fallback
        }
    };

    const openEventLink = (url) => {
        if (url) {
            Linking.canOpenURL(url).then(supported => {
                if (supported) {
                    Linking.openURL(url);
                } else {
                    Alert.alert("Lỗi", `Không thể mở đường dẫn: ${url}`);
                }
            });
        } else {
            Alert.alert("Thông báo", "Sự kiện này không có đường dẫn chi tiết.");
        }
    };

    const renderEventItem = ({ item }) => (
        <TouchableOpacity
            style={styles.eventItem}
            onPress={() => openEventLink(item.originalUrl)} // Mở link gốc của sự kiện
        >
            <Image
                source={{ uri: item.imageUrl || 'https://via.placeholder.com/120x100.png?text=HSU+Event' }} // Ảnh placeholder nếu không có
                style={styles.eventImage}
            />
            <View style={styles.eventInfo}>
                <Text style={styles.eventName} numberOfLines={2}>{item.eventName}</Text>
                <View style={styles.eventDetailRow}>
                    <FontAwesome5 name="calendar-alt" size={12} color="#555" style={styles.detailIcon} />
                    <Text style={styles.eventDetailText}>{formatDateRange(item.startDate, item.endDate, item.timeString)}</Text>
                </View>
                {item.location && (
                    <View style={styles.eventDetailRow}>
                        <FontAwesome5 name="map-marker-alt" size={12} color="#555" style={styles.detailIcon} />
                        <Text style={styles.eventDetailText} numberOfLines={1}>{item.location}</Text>
                    </View>
                )}
                {item.category && (
                     <View style={styles.categoryBadge}>
                        <Text style={styles.categoryText}>{item.category}</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );

    // Giao diện khi đang tải dữ liệu lần đầu
    if (isLoading && events.length === 0) {
        return (
            <SafeAreaView style={styles.centered}>
                <ActivityIndicator size="large" color="#002366" />
                <Text style={styles.loadingText}>Đang tải danh sách sự kiện...</Text>
            </SafeAreaView>
        );
    }

    // Giao diện khi có lỗi xảy ra
    if (error) {
        return (
            <SafeAreaView style={styles.centered}>
                <FontAwesome5 name="exclamation-triangle" size={40} color="#D32F2F" style={{marginBottom:15}} />
                <Text style={styles.errorText}>Lỗi: {error}</Text>
                <TouchableOpacity onPress={() => fetchEvents()} style={styles.retryButton}>
                    <Text style={styles.retryButtonText}>Thử lại</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // Giao diện chính
    return (
        <SafeAreaView style={styles.safeArea}>
            {events.length === 0 && !isLoading ? ( // Nếu không có sự kiện nào và không đang loading
                 <ScrollView
                    contentContainerStyle={styles.centered}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#002366"]}/>}
                 >
                    <FontAwesome5 name="calendar-times" size={60} color="#bdc3c7" style={{marginBottom:20}} />
                    <Text style={styles.noEventsText}>Hiện chưa có sự kiện nào sắp hoặc đang diễn ra.</Text>
                    <Text style={styles.noEventsSubText}>Vui lòng quay lại sau hoặc kiểm tra các kênh thông tin khác của trường.</Text>
                </ScrollView>
            ) : (
                <FlatList
                    data={events}
                    renderItem={renderEventItem}
                    keyExtractor={(item) => item._id.toString()}
                    contentContainerStyle={styles.listContainer}
                    refreshControl={ // Cho phép kéo để làm mới
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#002366"]}/>
                    }
                    // onEndReached={handleLoadMore} // Cho infinite scroll
                    // onEndReachedThreshold={0.5}     // Cách đáy bao nhiêu thì trigger load more
                    // ListFooterComponent={isLoadingMore ? <ActivityIndicator size="small" color="#002366" style={{marginVertical:10}}/> : null}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F4F7F9' }, // Màu nền chung
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    loadingText: { marginTop: 10, fontSize: 15, color: '#555' },
    errorText: { color: '#D32F2F', fontSize:15, marginTop: 10, textAlign:'center', fontWeight:'500' },
    retryButton: { backgroundColor: '#002366', paddingVertical: 10, paddingHorizontal:25, borderRadius:8, marginTop:20},
    retryButtonText: { color: '#fff', fontWeight:'bold', fontSize: 15},
    noEventsText: { fontSize: 17, color: '#455a64', textAlign:'center', fontWeight:'600' },
    noEventsSubText: { fontSize: 14, color: '#78909c', textAlign:'center', marginTop: 8},
    listContainer: { paddingHorizontal: 15, paddingTop: 15, paddingBottom: 5 },
    eventItem: {
        backgroundColor: '#fff',
        borderRadius: 10,
        marginBottom: 15,
        flexDirection: 'row', // Để hình ảnh và thông tin nằm cạnh nhau
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
        overflow: 'hidden', // Đảm bảo border radius áp dụng cho cả Image
    },
    eventImage: {
        width: 120, // Chiều rộng cố định cho hình ảnh
        height: 130, // Chiều cao cố định, hoặc bỏ đi để tự điều chỉnh theo eventInfo
        backgroundColor: '#e9ecef', // Màu placeholder nếu ảnh chưa load
    },
    eventInfo: {
        flex: 1, // Chiếm phần còn lại của item
        padding: 12,
        justifyContent: 'space-between', // Căn chỉnh nội dung trong eventInfo
    },
    eventName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#003974', // Màu xanh HSU đậm hơn
        marginBottom: 5,
    },
    eventDetailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start', // Căn theo đầu dòng nếu text dài
        marginBottom: 4,
    },
    detailIcon: {
        marginRight: 6,
        marginTop: 2, // Chỉnh icon cho thẳng hàng với dòng text đầu tiên
    },
    eventDetailText: {
        fontSize: 12,
        color: '#424242', // Màu chữ tối hơn chút
        flex: 1, // Cho phép text wrap nếu dài
        lineHeight: 16,
    },
    categoryBadge: {
        marginTop: 6,
        backgroundColor: '#e0f7fa', // Màu nền badge (xanh dương nhạt)
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    categoryText: {
        fontSize: 10,
        color: '#00796b', // Màu chữ cho badge (xanh lá cây đậm)
        fontWeight: '600',
    }
});

export default EventScreen;