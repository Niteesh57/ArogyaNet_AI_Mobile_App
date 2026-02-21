import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useState, useRef, useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Send, Bot, User as UserIcon, Wifi, WifiOff } from "lucide-react-native";
import NetInfo from "@react-native-community/netinfo";
import { askAI, isLocalModelAvailable } from "../../lib/ai";

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    source?: 'cloud' | 'local';
}

export default function ChatScreen() {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isConnected, setIsConnected] = useState<boolean | null>(true);
    const [hasLocalModel, setHasLocalModel] = useState(false);

    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        // Check network status
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsConnected(state.isConnected);
        });

        // Check if local model is present
        checkModel();

        return () => unsubscribe();
    }, []);

    const checkModel = async () => {
        const available = await isLocalModelAvailable();
        setHasLocalModel(available);
    }

    const sendMessage = async () => {
        if (!input.trim()) return;

        const userMsg: Message = { id: Date.now().toString(), text: input, sender: 'user' };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        try {
            const responseText = await askAI(userMsg.text);

            // Determine source based on connection (heuristic)
            // Practically, askAI handles the switch, but we want to show the user where it came from.
            // We can infer it: if connected, likely cloud. If not, local.
            // However, askAI falls back to local if cloud fails. 
            // For UI simplicity, we'll just show what the network state is.
            const source = isConnected ? 'cloud' : 'local';

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: responseText,
                sender: 'ai',
                source: source
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: "Sorry, I encountered an error processing your request.",
                sender: 'ai'
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
            setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
        }
    };

    const renderItem = ({ item }: { item: Message }) => (
        <View className={`flex-row mb-4 ${item.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            {item.sender === 'ai' && (
                <View className={`w-8 h-8 rounded-full items-center justify-center mr-2 ${item.source === 'local' ? 'bg-green-100' : 'bg-blue-100'}`}>
                    <Bot size={20} color={item.source === 'local' ? '#16A34A' : '#2563EB'} />
                </View>
            )}

            <View className={`p-3 rounded-2xl max-w-[80%] ${item.sender === 'user'
                ? 'bg-blue-600 rounded-br-none'
                : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-bl-none'
                }`}>
                <Text className={`${item.sender === 'user' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                    {item.text}
                </Text>
                {item.sender === 'ai' && (
                    <Text className="text-[10px] text-gray-400 mt-1 text-right uppercase">
                        {item.source} model
                    </Text>
                )}
            </View>

            {item.sender === 'user' && (
                <View className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full items-center justify-center ml-2">
                    <UserIcon size={20} color="#4B5563" />
                </View>
            )}
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <View className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-row justify-between items-center shadow-sm">
                <View>
                    <Text className="text-lg font-bold text-gray-900 dark:text-white">Arogya AI Assistant</Text>
                    <Text className="text-xs text-gray-500">
                        {isConnected ? "Online • Cloud Agent Active" : "Offline • Local MedGemma Active"}
                    </Text>
                </View>
                <View className="flex-row items-center gap-2">
                    {!hasLocalModel && (
                        <Text className="text-[10px] text-red-500 bg-red-50 px-2 py-1 rounded">No Model</Text>
                    )}
                    {isConnected ? <Wifi size={20} color="#16A34A" /> : <WifiOff size={20} color="#9CA3AF" />}
                </View>
            </View>

            {/* Chat Area */}
            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 16 }}
                className="flex-1"
            />

            {/* Input Area */}
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
                <View className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex-row items-center">
                    <TextInput
                        className="flex-1 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white rounded-full px-4 py-3 mr-3"
                        placeholder="Ask about vitals, symptoms..."
                        placeholderTextColor="#9CA3AF"
                        value={input}
                        onChangeText={setInput}
                        editable={!isLoading}
                    />
                    <TouchableOpacity
                        onPress={sendMessage}
                        disabled={isLoading || !input.trim()}
                        className={`w-12 h-12 rounded-full items-center justify-center ${isLoading || !input.trim() ? 'bg-gray-300' : 'bg-teal-600'}`}
                    >
                        {isLoading ? <ActivityIndicator color="white" /> : <Send size={20} color="white" />}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
