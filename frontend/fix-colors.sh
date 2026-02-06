#!/bin/bash
# Fix hardcoded colors script for Feeds frontend
# Run this from the frontend directory

echo "Fixing hardcoded colors in remaining files..."

# Fix VideoModal.tsx
sed -i '' 's/color="#fff"/color={colors.text.inverse}/g' components/VideoModal.tsx

# Fix PodcastPlayer.tsx  
sed -i '' 's/color="#fff"/color={colors.text.inverse}/g' components/PodcastPlayer.tsx

# Fix PodcastSection.tsx
sed -i '' 's/color="#fff"/color={colors.text.inverse}/g' components/PodcastSection.tsx

# Fix FloatingPlayer.tsx
sed -i '' 's/color="#fff"/color={colors.text.inverse}/g' components/FloatingPlayer.tsx

# Fix ErrorBoundary.tsx
sed -i '' 's/color="#fff"/color={colors.text.inverse}/g' components/ErrorBoundary.tsx

# Fix FloatingAudioPlayer.tsx
sed -i '' 's/color="#fff"/color={colors.text.inverse}/g' components/FloatingAudioPlayer.tsx

# Fix DiscoveryPage.tsx
sed -i '' 's/color="#FFF"/color={colors.text.inverse}/g' components/DiscoveryPage.tsx
sed -i '' 's/color="#fff"/color={colors.text.inverse}/g' components/DiscoveryPage.tsx

# Fix DigestCard.tsx
sed -i '' 's/color="#fff"/color={colors.text.inverse}/g' components/DigestCard.tsx

# Fix ArticleFooter.tsx
sed -i '' 's/color="#fff"/color={colors.text.inverse}/g' components/ArticleFooter.tsx

# Fix BookmarksList.tsx
sed -i '' 's/color="#fff"/color={colors.text.inverse}/g' components/BookmarksList.tsx

echo "Done! Please review the changes and ensure useColors is imported in each file."
