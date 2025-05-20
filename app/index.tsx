import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '../constants/Colors';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { DownloadedSong, downloadSong, searchSongs, Track } from '../services/api';
import { clearRecentSearches, getDownloadedSongs, getRecentSearches, saveRecentSearch, saveSong } from '../services/storage';

export default function SearchScreen() {
  const { width } = useWindowDimensions();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [downloadedSongs, setDownloadedSongs] = useState<DownloadedSong[]>([]);
  const { playSong, setPlaylist } = useAudioPlayer();
  const searchInputRef = useRef<TextInput>(null);
  const router = useRouter();

  const fetchRecentSearches = async () => {
    const searches = await getRecentSearches();
    setRecentSearches(searches);
  };

  // Load recent searches when the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchRecentSearches();
      loadDownloadedSongs();
    }, [])
  );

  const loadDownloadedSongs = async () => {
    const songs = await getDownloadedSongs();
    setDownloadedSongs(songs);
  };

  const handleSearch = async (query?: string) => {
    const searchTerm = (query || searchQuery || '').trim();
    if (!searchTerm) return;

    setIsLoading(true);
    setSearchResults([]); // Clear previous results immediately
    try {
      const results = await searchSongs(searchTerm);
      // Check against downloaded songs before setting search results
      const songs = await getDownloadedSongs(); // Re-fetch or use state
      setDownloadedSongs(songs);

      setSearchResults(results);
      if (results.length > 0) {
        await saveRecentSearch(searchTerm); // Save successful search term
        fetchRecentSearches(); // Refresh recent searches list
      }
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Error', 'Failed to search songs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (track: Track) => {
    // Check if a download is already in progress
    if (downloading) {
      Alert.alert('Download in Progress', 'Please wait for the current download to complete before starting a new one.');
      return;
    }
    
    setDownloading(track.uri);
    try {
      const downloadedSong = await downloadSong(track);
      if (downloadedSong) {
        await saveSong(downloadedSong);
        Alert.alert('Success', `${track.name} has been downloaded`);
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download song');
    } finally {
      setDownloading(null);
    }
  };

  const handlePlayDownloadedSong = async (songToPlay: DownloadedSong) => {
    await playSong(songToPlay);
    router.push('/player');
  };

  const renderTrackItem = ({ item }: { item: Track }) => {
    const artistsText = item.artists.join(', ');
    const isDownloading = downloading === item.uri;

    // Check if this search result item is already downloaded
    const downloadedVersion = downloadedSongs.find(
      ds => ds.title.toLowerCase() === item.name.toLowerCase() && 
            ds.album.toLowerCase() === item.album.toLowerCase() && 
            ds.artist.toLowerCase() === artistsText.toLowerCase()
    );


    return (
      <TouchableOpacity 
        style={styles.trackItem}
        onPress={() => downloadedVersion ? handlePlayDownloadedSong(downloadedVersion) : handleDownload(item)}
      >
        <View style={styles.coverContainer}>
          <Image source={{ uri: item.cover_image }} style={styles.coverImage} />
          <View style={styles.playIconOverlay}>
            <Ionicons name="musical-note" size={24} color="rgba(255,255,255,0.9)" />
          </View>
        </View>
        <View style={styles.trackInfo}>
          <Text style={styles.trackName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.artistName} numberOfLines={1}>{artistsText}</Text>
          <Text style={styles.albumName} numberOfLines={1}>{item.album}</Text>
        </View>
        <View style={styles.downloadButton}>
          {isDownloading ? (
            <ActivityIndicator color={Colors.dark.primary} size="small" />
          ) : downloadedVersion ? (
            <View style={styles.downloadButtonInner}> 
              <Ionicons name="play-circle" size={24} color={Colors.dark.primary} />
            </View>
          ) : (
            <View style={styles.downloadButtonInner}>
              <Ionicons name="download" size={24} color={Colors.dark.primary} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderRecentSearchItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={styles.recentSearchChip}
      onPress={() => {
        setSearchQuery(item); // Update the input field
        handleSearch(item);   // Perform the search with the selected term
      }}
    >
      <Text style={styles.recentSearchText}>{item}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.searchContainer}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for songs..."
            placeholderTextColor={Colors.dark.subText}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => handleSearch()} // Triggers search on keyboard submit
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity 
              style={styles.clearButton} 
              onPress={() => {
                setSearchQuery('');
                setSearchResults([]); // Clear search results
                Keyboard.dismiss(); // Retract keyboard
              }}
            >
              <Ionicons name="close-circle" size={20} color={Colors.dark.subText} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity 
          style={styles.searchButton} 
          onPress={() => handleSearch()}
        >
          <Ionicons name="search" size={24} color={Colors.dark.text} />
        </TouchableOpacity>
      </View>

      {/* Recent Searches Section */}
      {searchResults.length === 0 && recentSearches.length > 0 && !isLoading && (
        <View style={styles.recentSearchesContainer}>
          <View style={styles.recentSearchesHeader}>
            <Text style={styles.recentSearchesTitle}>Recent Searches</Text>
            <TouchableOpacity onPress={async () => { await clearRecentSearches(); fetchRecentSearches(); }}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={recentSearches}
            renderItem={renderRecentSearchItem}
            keyExtractor={(item, index) => `${item}-${index}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentSearchesList}
          />
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.primary} />
        </View>
      ) : searchResults.length > 0 ? (
        <FlatList
          data={searchResults}
          renderItem={renderTrackItem}
          keyExtractor={(item) => item.uri}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="musical-notes" size={64} color={Colors.dark.secondary} />
          <Text style={styles.emptyText}>
            {searchQuery.trim() ? 'No results found' : 'Search for your favorite songs'}
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
  recentSearchesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  recentSearchesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recentSearchesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  clearButtonText: {
    fontSize: 14,
    color: Colors.dark.primary,
  },
  recentSearchesList: {
    paddingRight: 16,
  },
  recentSearchChip: {
    backgroundColor: Colors.dark.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  recentSearchText: {
    color: Colors.dark.text,
    fontSize: 13,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    alignItems: 'center',
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    marginRight: 10,
    height: 48,
  },
  searchInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: 16,
    color: Colors.dark.text,
    fontSize: 15,
  },
  clearButton: {
    padding: 8,
    marginRight: 4,
  },
  searchButton: {
    width: 48,
    height: 48,
    backgroundColor: Colors.dark.primary,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 16,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  coverContainer: {
    position: 'relative',
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
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
    opacity: 0.7,
  },
  trackInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
    marginRight: 8,
  },
  trackName: {
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
  },
  downloadButton: {
    padding: 8,
    marginLeft: 'auto',
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
    height: 44,
  },
  downloadButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(29,185,84,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.dark.subText,
    textAlign: 'center',
  },
});