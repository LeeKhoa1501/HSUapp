// components/TodayTimetableCard.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

const TodayTimetableCard = ({ title, entries, isLoading, error, onSeeAllPress, onEntryPress }) => {
    return (
        <View style={styles.cardContainer}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{title}</Text>
                {entries && entries.length > 0 && ( // Chỉ hiển thị nút nếu có entries
                    <TouchableOpacity onPress={onSeeAllPress}>
                        <Text style={styles.seeAllText}>Xem tất cả</Text>
                    </TouchableOpacity>
                )}
            </View>

            {isLoading ? (
                <ActivityIndicator size="small" color="#0056b3" style={styles.loadingIndicator} />
            ) : error ? (
                <Text style={styles.errorText}>{error}</Text>
            ) : !entries || entries.length === 0 ? (
                <Text style={styles.noEntryText}>Hôm nay không có lịch học.</Text>
            ) : (
                entries.slice(0, 3).map((entry, index) => ( // Chỉ hiển thị tối đa 3 buổi
                    <TouchableOpacity
                        key={entry._id || index.toString()}
                        style={styles.entryItem}
                        onPress={() => onEntryPress && onEntryPress(entry)} // Nếu có hàm xử lý khi bấm vào entry
                    >
                        <FontAwesome5 name="clock" size={14} color="#007bff" style={styles.entryIcon} />
                        <View style={styles.entryTextContainer}>
                            <Text style={styles.entryTime}>{entry.startTime} - {entry.endTime}</Text>
                            <Text style={styles.entryCourseName} numberOfLines={1}>{entry.courseName || 'N/A'}</Text>
                             {entry.room && <Text style={styles.entryRoom}>Phòng: {entry.room}</Text>}
                        </View>
                    </TouchableOpacity>
                ))
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    cardContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 15,
        marginHorizontal: 20,
        marginTop: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 5,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#343a40',
    },
    seeAllText: {
        fontSize: 14,
        color: '#007bff',
        fontWeight: '500',
    },
    loadingIndicator: {
        marginVertical: 20,
    },
    errorText: {
        color: 'red',
        textAlign: 'center',
        marginVertical: 20,
        fontSize: 14,
    },
    noEntryText: {
        color: '#6c757d',
        textAlign: 'center',
        marginVertical: 20,
        fontSize: 15,
        fontStyle: 'italic',
    },
    entryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
    },
    entryIcon: {
        marginRight: 12,
    },
    entryTextContainer: {
        flex: 1,
    },
    entryTime: {
        fontSize: 14,
        fontWeight: '600',
        color: '#212529',
    },
    entryCourseName: {
        fontSize: 15,
        color: '#495057',
        marginTop: 2,
    },
    entryRoom: {
        fontSize: 13,
        color: '#868e96',
        marginTop: 2,
    },
});

export default React.memo(TodayTimetableCard);