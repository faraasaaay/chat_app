import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '../constants/Colors';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { DownloadedSong } from '../services/api';
import { deleteSong, getDownloadedSongs } from '../services/storage';

export default function LibraryScreen() {
  const { width } = useWindowDimensions();
  const [songs, setSongs] = useState<DownloadedSong[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { playSong, setPlaylist, currentSong, isPlaying } = useAudioPlayer();

  useEffect(() => {
    loadSongs();
  }, []);

  const loadSongs = async () => {
    setIsLoading(true);
    try {
      const downloadedSongs = await getDownloadedSongs();
      setSongs(downloadedSongs);
      // Set the playlist for the audio player
      setPlaylist(downloadedSongs);
    } catch (error) {
      console.error('Error loading songs:', error);
      Alert.alert('Error', 'Failed to load downloaded songs');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlaySong = async (song: DownloadedSong) => {
    try {
      await playSong(song);
      router.push('/player');
    } catch (error) {
      console.error('Error playing song:', error);
      Alert.alert('Error', 'Failed to play song');
    }
  };

  const handleDeleteSong = async (song: DownloadedSong) => {
    Alert.alert(
      'Delete Song',
      `Are you sure you want to delete "${song.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSong(song.id);
              // Refresh the list
              loadSongs();
            } catch (error) {
              console.error('Error deleting song:', error);
              Alert.alert('Error', 'Failed to delete song');
            }
          },
        },
      ]
    );
  };

  const renderSongItem = ({ item }: { item: DownloadedSong }) => {
    return (
      <TouchableOpacity 
        style={styles.songItem} 
        onPress={() => handlePlaySong(item)}
      >
        <View style={styles.coverContainer}>
          <Image source={{ uri: item.coverImage }} style={styles.coverImage} />
          <View style={styles.playIconOverlay}>
            <Ionicons name={isPlaying && currentSong?.id === item.id ? 'pause-circle' : 'play-circle'} size={32} color="rgba(255,255,255,0.9)" />
          </View>
        </View>
        <View style={styles.songInfo}>
          <Text style={styles.songTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.artistName} numberOfLines={1}>{item.artist}</Text>
          <Text style={styles.albumName} numberOfLines={1}>{item.album}</Text>
          <View style={styles.downloadedIndicator}>
            <Ionicons name="cloud-done-outline" size={12} color={Colors.dark.primary} />
            <Text style={styles.downloadedText}>Downloaded</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.deleteButton} 
          onPress={() => handleDeleteSong(item)}
        >
          <Ionicons name="trash-outline" size={22} color={Colors.dark.error} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Downloaded Songs</Text>
        <TouchableOpacity onPress={loadSongs}>
          <Ionicons name="refresh" size={24} color={Colors.dark.primary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      ) : songs.length > 0 ? (
        <FlatList
          data={songs}
          renderItem={renderSongItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="cloud-download-outline" size={64} color={Colors.dark.secondary} />
          <Text style={styles.emptyText}>
            No downloaded songs yet.
          </Text>
          <Text style={styles.emptySubText}>
            Search and download songs to listen offline.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16, // Keep bottom padding for scrollable content
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12, // Adjusted margin
    backgroundColor: Colors.dark.card,
    borderRadius: 10, // Adjusted border radius
    padding: 10, // Adjusted padding
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  coverContainer: {
    position: 'relative',
    width: 60, // Adjusted size
    height: 60, // Adjusted size
    borderRadius: 8,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  playIconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.8,
  },
  songInfo: {
    flex: 1,
    marginLeft: 12, // Adjusted margin
    marginRight: 8, // Add space before delete button
  },
  songTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  artistName: {
    fontSize: 14,
    color: Colors.dark.subText,
    marginBottom: 2,
  },
  albumName: {
    fontSize: 12,
    color: Colors.dark.subText,
    marginBottom: 6,
  },
  downloadedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadedText: {
    fontSize: 11,
    color: Colors.dark.primary,
    marginLeft: 4,
  },
  deleteButton: { 
    padding: 8,
    marginLeft: 'auto', // Push to the far right
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 14,
    color: Colors.dark.subText,
    marginTop: 8,
    textAlign: 'center',
  },
});