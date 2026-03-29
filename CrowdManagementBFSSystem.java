import java.io.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

class Zone {
    int id;
    String name;
    int crowd;
    List<Integer> crowdHistory;
    double x, y;

    Zone(int id, String name, int crowd, double x, double y) {
        this.id = id;
        this.name = name;
        this.crowd = crowd;
        this.crowdHistory = new CopyOnWriteArrayList<>();
        this.crowdHistory.add(crowd);
        this.x = x;
        this.y = y;
    }
}

class Edge {
    int to;

    Edge(int to) {
        this.to = to;
    }
}

public class CrowdManagementBFSSystem {
    private static final int CROWD_THRESHOLD = 50; 
    private static Map<Integer, List<Edge>> graph = new ConcurrentHashMap<>();
    private static Map<Integer, Zone> zones = new ConcurrentHashMap<>();
    private static ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
    private static List<String> alerts = new CopyOnWriteArrayList<>();
    public static int startZone = 1;
    public static int endZone = 6;

    public static void main(String[] args) throws IOException {
        // Initialize sample network
        addZone(1, "Main Entrance (Camera)", 0, 100, 300);
        addZone(2, "Lobby", 20, 300, 300);
        addZone(3, "Hall A", 15, 500, 150);
        addZone(4, "Hall B", 25, 500, 450);
        addZone(5, "Corridor", 10, 700, 300);
        addZone(6, "Exit", 5, 900, 300);

        addEdge(1, 2);
        addEdge(2, 3);
        addEdge(2, 4);
        addEdge(3, 5);
        addEdge(4, 5);
        addEdge(5, 6);
        addEdge(3, 6); // Shortcut

        simulateCloudAnalytics();

        HttpServer server = HttpServer.create(new InetSocketAddress(8080), 0);
        server.createContext("/api/state", new StateHandler());
        server.createContext("/api/crowd", new CrowdHandler());
        server.setExecutor(Executors.newFixedThreadPool(10));
        server.start();

        System.out.println("Java Backend server started on http://localhost:8080");
        System.out.println("Waiting for frontend connections...");
    }

    private static void addEdge(int u, int v) {
        graph.computeIfAbsent(u, k -> new CopyOnWriteArrayList<>()).add(new Edge(v));
        graph.computeIfAbsent(v, k -> new CopyOnWriteArrayList<>()).add(new Edge(u));
    }

    private static void addZone(int id, String name, int crowd, double x, double y) {
        zones.put(id, new Zone(id, name, crowd, x, y));
        graph.putIfAbsent(id, new CopyOnWriteArrayList<>());
    }

    private static void simulateCloudAnalytics() {
        scheduler.scheduleAtFixedRate(() -> {
            alerts.clear();
            double totalDensity = zones.values().stream()
                .mapToDouble(z -> z.crowd / 100.0)
                .sum() / (zones.size() == 0 ? 1 : zones.size());
                
            if (totalDensity > 0.8) {
                alerts.add("High overall crowd density: " + String.format("%.2f", totalDensity));
            }
            
            for (Zone zone : zones.values()) {
                if (zone.crowd > CROWD_THRESHOLD) {
                    alerts.add("Critical: " + zone.name + " is overcrowded (" + zone.crowd + ")!");
                } else if (zone.crowd > CROWD_THRESHOLD - 10) {
                    alerts.add("Warning: " + zone.name + " is near capacity (" + zone.crowd + ").");
                }
            }
        }, 0, 5, TimeUnit.SECONDS);
    }

    private static List<List<Integer>> findAllSafePaths(int start, int end) {
        Queue<List<Integer>> queue = new LinkedList<>();
        List<List<Integer>> allPaths = new ArrayList<>();
        queue.add(Arrays.asList(start));

        while (!queue.isEmpty() && allPaths.size() < 3) {
            List<Integer> path = queue.poll();
            int current = path.get(path.size() - 1);

            if (current == end) {
                allPaths.add(new ArrayList<>(path));
                continue;
            }

            for (Edge neighbor : graph.getOrDefault(current, new ArrayList<>())) {
                if (!path.contains(neighbor.to) && zones.get(neighbor.to).crowd < CROWD_THRESHOLD) {
                    List<Integer> newPath = new ArrayList<>(path);
                    newPath.add(neighbor.to);
                    queue.add(newPath);
                }
            }
        }
        return allPaths;
    }

    static class StateHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            StringBuilder json = new StringBuilder("{\n\"zones\": [");
            List<Zone> zoneList = new ArrayList<>(zones.values());
            for (int i = 0; i < zoneList.size(); i++) {
                Zone z = zoneList.get(i);
                json.append(String.format(Locale.US, "{\"id\":%d, \"name\":\"%s\", \"crowd\":%d, \"x\":%f, \"y\":%f}",
                        z.id, z.name, z.crowd, z.x, z.y));
                if (i < zoneList.size() - 1) json.append(",");
            }
            json.append("],\n\"edges\": [");
            
            Set<String> addedEdges = new HashSet<>();
            List<String> edgeStrings = new ArrayList<>();
            for (Map.Entry<Integer, List<Edge>> entry : graph.entrySet()) {
                int u = entry.getKey();
                for (Edge e : entry.getValue()) {
                    int v = e.to;
                    String edgeKey = Math.min(u, v) + "-" + Math.max(u, v);
                    if (addedEdges.add(edgeKey)) {
                        edgeStrings.add(String.format(Locale.US, "{\"source\":%d, \"target\":%d}", u, v));
                    }
                }
            }
            json.append(String.join(",", edgeStrings));
            
            json.append("],\n\"paths\": [");
            List<List<Integer>> paths = findAllSafePaths(startZone, endZone);
            for (int i = 0; i < paths.size(); i++) {
                json.append("[");
                for (int j = 0; j < paths.get(i).size(); j++) {
                    json.append(paths.get(i).get(j));
                    if (j < paths.get(i).size() - 1) json.append(",");
                }
                json.append("]");
                if (i < paths.size() - 1) json.append(",");
            }
            
            json.append("],\n\"alerts\": [");
            for (int i = 0; i < alerts.size(); i++) {
                json.append(String.format(Locale.US, "\"%s\"", alerts.get(i).replace("\"", "\\\"")));
                if (i < alerts.size() - 1) json.append(",");
            }
            json.append("]\n}");

            byte[] responseBytes = json.toString().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, responseBytes.length);
            OutputStream os = exchange.getResponseBody();
            os.write(responseBytes);
            os.close();
        }
    }

    static class CrowdHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }
            
            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                InputStream is = exchange.getRequestBody();
                String body = new String(is.readAllBytes(), StandardCharsets.UTF_8);
                
                try {
                    int zoneId = extractInt(body, "zoneId");
                    int crowd = extractInt(body, "crowd");
                    if (zoneId != -1 && crowd != -1 && zones.containsKey(zoneId)) {
                        zones.get(zoneId).crowd = crowd;
                        System.out.println("Updated Zone " + zoneId + " crowd to " + crowd);
                    }
                } catch (Exception e) {
                    System.err.println("Failed to parse incoming crowd data.");
                }

                String response = "{\"status\":\"ok\"}";
                byte[] responseBytes = response.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, responseBytes.length);
                OutputStream os = exchange.getResponseBody();
                os.write(responseBytes);
                os.close();
            } else {
                exchange.sendResponseHeaders(405, -1);
            }
        }
        
        private int extractInt(String json, String key) {
            String search = "\"" + key + "\":";
            int idx = json.indexOf(search);
            if (idx == -1) {
                // Try without quotes
                search = key + ":";
                idx = json.indexOf(search);
                if (idx == -1) return -1;
            }
            idx += search.length();
            int endIdx = idx;
            while (endIdx < json.length() && (Character.isDigit(json.charAt(endIdx)) || json.charAt(endIdx) == ' ')) {
                endIdx++;
            }
            try {
                return Integer.parseInt(json.substring(idx, endIdx).trim());
            } catch (NumberFormatException e) {
                return -1;
            }
        }
    }

    private static void addCorsHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type,Authorization");
    }
}