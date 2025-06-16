// HSUMobileApp/screens/components/NotificationItem.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { format, parseISO,isValid } from 'date-fns'; // Thêm isValid
import vi from 'date-fns/locale/vi';

const formatDateDisplay = (dateString) => {
    if (!dateString) return '';
    try {
        const date = parseISO(dateString);
        if (isValid(date)) { // Kiểm tra xem date có hợp lệ không
            return format(date, 'dd/MM/yyyy', { locale: vi });
        }
        // Thử parse bằng new Date nếu parseISO thất bại hoặc date không hợp lệ
        const fallbackDate = new Date(dateString);
        if (isValid(fallbackDate)) {
            return format(fallbackDate, 'dd/MM/yyyy', { locale: vi });
        }
        return 'N/A';
    } catch (e) {
        console.warn("[NotificationItem] formatDateDisplay error:", dateString, e);
        return 'N/A';
    }
};

const NotificationItem = React.memo(({ item, onPress }) => {
    if (!item || !item._id) {
        console.warn("[NotificationItem] Received invalid item data:", item);
        return null;
    }

    const isUnread = !item.isRead;

    return (
        <TouchableOpacity style={styles.itemContainer} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.iconContainer}>
                <FontAwesome5
                    name="bell"
                    size={20} // Kích thước icon nhỏ hơn một chút
                    color={isUnread ? "#0056b3" : "#757575"} // Màu xanh HSU cho chưa đọc
                    solid={isUnread} // Icon solid nếu chưa đọc
                />
                {isUnread && <View style={styles.unreadDot} />}
            </View>
            <View style={styles.contentContainer}>
                <View style={styles.headerContainer}>
                    <Text style={[styles.title, isUnread && styles.unreadTitle]} numberOfLines={2}>
                        {item.title || 'Thông báo mới'}
                    </Text>
                    <Text style={styles.dateText}>{formatDateDisplay(item.createdAt || item.sentAt)}</Text>
                </View>
                {item.shortDescription && (
                    <Text style={styles.description} numberOfLines={Platform.OS === 'ios' ? 2 : 3}>
                        {/* Tăng số dòng cho Android vì cách tính toán hiển thị có thể khác */}
                        {item.shortDescription}
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    itemContainer: {
        flexDirection: 'row',
        paddingVertical: 16,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: StyleSheet.hairlineWidth, // Đường kẻ mảnh hơn
        borderBottomColor: '#E0E0E0',
    },
    iconContainer: {
        marginRight: 16,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 3, // Căn chỉnh icon với dòng đầu của title
        width: 24, // Cho icon một không gian cố định
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF3B30', // Màu đỏ cho thông báo chưa đọc
        position: 'absolute',
        top: 1,
        right: 1,
    },
    contentContainer: {
        flex: 1,
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 5,
    },
    title: {
        fontSize: 15, // Kích thước title
        fontWeight: '500',
        color: '#2c3e50', // Màu chữ đậm hơn chút
        flex: 1,
        marginRight: 8,
        lineHeight: 20,
    },
    unreadTitle: {
        fontWeight: 'bold',
        color: '#004a99', // Màu xanh đậm hơn cho title chưa đọc
    },
    dateText: {
        fontSize: 12,
        color: '#7f8c8d', // Màu ngày tháng nhạt hơn
    },
    description: {
        fontSize: 13, // Kích thước mô tả
        color: '#34495e', // Màu chữ mô tả
        lineHeight: 18,
    },
});

export default NotificationItem;