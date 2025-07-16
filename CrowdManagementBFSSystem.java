import java.util.*;
import java.util.concurrent.*;

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
        this.crowdHistory = new ArrayList<>();
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
    private static final int CROWD_THRESHOLD = 100;
    private static Map<Integer, List<Edge>> graph = new HashMap<>();
    private static Map<Integer, Zone> zones = new HashMap<>();
    private static ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
    private static Random random = new Random();
    private static List<String> alerts = Collections.synchronizedList(new ArrayList<>());

    private static void addEdge(int u, int v) {
        graph.computeIfAbsent(u, k -> new ArrayList<>()).add(new Edge(v));
        graph.computeIfAbsent(v, k -> new ArrayList<>()).add(new Edge(u));
    }

    private static void addZone(int id, String name, int crowd, double x, double y) {
        zones.put(id, new Zone(id, name, crowd, x, y));
        graph.putIfAbsent(id, new ArrayList<>());
    }

    private static void simulateCameraFeed() {
        scheduler.scheduleAtFixedRate(() -> {
            for (Zone zone : zones.values()) {
                int change = random.nextInt(21) - 10;
                zone.crowd = Math.max(0, zone.crowd + change);
                zone.crowdHistory.add(zone.crowd);
                if (zone.crowdHistory.size() > 10) zone.crowdHistory.remove(0);

                if (zone.crowdHistory.size() >= 2) {
                    int last = zone.crowdHistory.get(zone.crowdHistory.size() - 1);
                    int prev = zone.crowdHistory.get(zone.crowdHistory.size() - 2);

                    if (last > prev && last > CROWD_THRESHOLD - 20) {
                        String alert = "Warning: Zone " + zone.name + " may become congested soon!";
                        alerts.add(alert);
                        System.out.println(alert);
                    }

                    if (last > CROWD_THRESHOLD) {
                        String alert = "Critical: Zone " + zone.name + " is overcrowded (" + last + ")!";
                        alerts.add(alert);
                        System.out.println(alert);
                    }
                }
            }
            System.out.println("Camera feed updated: " + zones);
        }, 0, 5, TimeUnit.SECONDS);
    }

    private static void simulateCloudAnalytics() {
        scheduler.scheduleAtFixedRate(() -> {
            System.out.println("Cloud: Processing unified crowd view...");
            double totalDensity = zones.values().stream()
                .mapToDouble(z -> z.crowd / 100.0)
                .sum() / zones.size();

            if (totalDensity > 0.8) {
                String alert = "High overall crowd density: " + String.format("%.2f", totalDensity);
                alerts.add(alert);
                System.out.println(alert);
            }
        }, 0, 10, TimeUnit.SECONDS);
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

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);

        System.out.print("Enter number of zones: ");
        int n = validateInt(scanner, 1, Integer.MAX_VALUE);
        for (int i = 0; i < n; i++) {
            System.out.print("Enter Zone ID, Name, Crowd Count, X, Y for zone " + (i + 1) + ": ");
            String[] input = scanner.nextLine().trim().split("\\s+");
            int id = Integer.parseInt(input[0]);
            String name = input[1];
            int crowd = Integer.parseInt(input[2]);
            double x = Double.parseDouble(input[3]);
            double y = Double.parseDouble(input[4]);
            addZone(id, name, crowd, x, y);
        }

        System.out.print("Enter number of paths: ");
        int e = validateInt(scanner, 0, Integer.MAX_VALUE);
        for (int i = 0; i < e; i++) {
            System.out.print("Enter connected zone IDs (u v) for path " + (i + 1) + ": ");
            String[] input = scanner.nextLine().trim().split("\\s+");
            int u = Integer.parseInt(input[0]);
            int v = Integer.parseInt(input[1]);
            addEdge(u, v);
        }

        System.out.print("Enter entry and exit zone IDs: ");
        String[] input = scanner.nextLine().trim().split("\\s+");
        int startZone = Integer.parseInt(input[0]);
        int endZone = Integer.parseInt(input[1]);

        // Start simulations only after input is complete
        simulateCameraFeed();
        simulateCloudAnalytics();

        List<List<Integer>> paths = findAllSafePaths(startZone, endZone);
        if (!paths.isEmpty()) {
            System.out.println("Safe Paths Found:");
            for (int i = 0; i < paths.size(); i++) {
                System.out.print("Path " + (i + 1) + ": ");
                for (int j = 0; j < paths.get(i).size(); j++) {
                    System.out.print(zones.get(paths.get(i).get(j)).name);
                    if (j < paths.get(i).size() - 1) System.out.print(" -> ");
                }
                System.out.println();
            }
        } else {
            System.out.println("No safe path available.");
        }

        System.out.print("Add new edge (u v) or type 'done': ");
        String update = scanner.nextLine().trim();
        while (!update.equals("done")) {
            String[] parts = update.split("\\s+");
            int u = Integer.parseInt(parts[0]);
            int v = Integer.parseInt(parts[1]);
            addEdge(u, v);
            System.out.print("Add new edge (u v) or type 'done': ");
            update = scanner.nextLine().trim();
        }

        scheduler.shutdown();
        scanner.close();
    }

    private static int validateInt(Scanner scanner, int min, int max) {
        while (true) {
            try {
                int value = Integer.parseInt(scanner.nextLine().trim());
                if (value >= min && value <= max) return value;
                System.out.print("Invalid input. Enter a number between " + min + " and " + max + ": ");
            } catch (NumberFormatException e) {
                System.out.print("Invalid input. Enter a valid integer: ");
            }
        }
    }
}
