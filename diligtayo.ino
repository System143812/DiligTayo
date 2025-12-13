#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

#define DHTPIN 18
#define DHTTYPE DHT22

const char* ssid = "gabby";
const char* password = "gabby1234";
String urlBase = "http://192.168.8.142:3007"; //pang local lang to ah
int mlHandicapTime = 200;
int mlPerSec = 5; //eto ung i-ccalibrate for better accuracy
String botName = "DiligTayo Bot auto";


struct PlantConfig {
  int plant_id;
  String name;
  String plant_nickname;
  int soil_pin;
  int pump_pin;
  int auto_mode;
  int min_moist;
  int max_moist;
  int is_watering;
  int auto_watering;
  int manual_watering;
  unsigned long waterStartTime;
  unsigned long waterCurrentTime;
};

PlantConfig plants[10];
int plantSize = 0;

WebServer server(80);

DHT dht(DHTPIN, DHTTYPE);

unsigned long humidityMillis = 0;
unsigned long soilMillis = 0;
unsigned long checkMillis = 0;

void resetDht() {
  pinMode(DHTPIN, OUTPUT);
  digitalWrite(DHTPIN, LOW);
  delay(1000);
  digitalWrite(DHTPIN, HIGH);
  delay(2000);
  dht.begin();
}

void updatePlantConfig() {
  HTTPClient http;
  http.begin(urlBase + "/api/getAllPlants");
  http.addHeader("Accept", "application/json");
  int responseCode = http.GET();
  if(responseCode != 200) Serial.println("Failed to get soil and pump pins");
  String payload = http.getString();
  StaticJsonDocument<512>updateDoc;
  DeserializationError err = deserializeJson(updateDoc, payload);
  if(err) { 
    Serial.println("Failed to parse json");
    return;
  };
  JsonArray arr = updateDoc.as<JsonArray>();
  plantSize = arr.size();
  for(int i = 0; i < plantSize; i++) {
    plants[i].plant_id = arr[i]["plant_id"];
    plants[i].plant_nickname = arr[i]["nickname"].as<String>();
    plants[i].soil_pin = arr[i]["soil_pin"];
    plants[i].pump_pin = arr[i]["pump_pin"];
    plants[i].auto_mode = arr[i]["auto"];
    plants[i].min_moist = arr[i]["min_moisture"];
    plants[i].max_moist = arr[i]["max_moisture"];
    plants[i].is_watering = arr[i]["is_watering"];

    pinMode(plants[i].soil_pin, INPUT);
    pinMode(plants[i].pump_pin, OUTPUT);
  }
  server.send(200, "application/json", R"({"message":"Updated Plant Config"})");
  http.end();
}

float computeWaterAmount(int waterTimeSecs) {
  return floor((mlPerSec * waterTimeSecs) * 10) / 10;
}

void turnOnPump(int pump_pin, int soil_pin, int max_moist) {
  for(int i = 0; i < plantSize; i++) {
    if(pump_pin == plants[i].pump_pin) {
      if(plants[i].is_watering == 0) {
        plants[i].waterStartTime = millis();
        plants[i].waterCurrentTime = millis();
        plants[i].is_watering = 1;
        Serial.print("Watering the plant...");
        digitalWrite(pump_pin, LOW);
      }
    }
  }
}

void turnOffStates(int plant_id) {
  for(int i = 0; i < plantSize; i++) {
    if(plant_id == plants[i].plant_id) {
      plants[i].is_watering = 0;
      plants[i].auto_watering = 0;
      plants[i].manual_watering = 0;
    }
  }
}

void turnOffPump(int pump_pin) {
  for(int i = 0; i < plantSize; i++) {
    if(plants[i].pump_pin == pump_pin) {
      digitalWrite(plants[i].pump_pin, HIGH);
      int totalWaterTime = (millis() - plants[i].waterStartTime) / 1000;
      float waterAmount = computeWaterAmount(totalWaterTime);
      const char* name;
      if (plants[i].auto_watering == 1) {
        name = botName.c_str();
      } else if (plants[i].name.length() > 0) {
        name = plants[i].name.c_str();
      } else {
        name = "Manual";
      }
      turnOffStates(plants[i].plant_id);
      HTTPClient http;
      StaticJsonDocument<256>announceDoc;
      announceDoc["plant_id"] = plants[i].plant_id;
      announceDoc["plant_nickname"] = plants[i].plant_nickname;
      announceDoc["amount"] = waterAmount;
      announceDoc["name"] = name;
      String json;
      serializeJson(announceDoc, json);  
      http.begin(urlBase + "/api/esp/announceWaterResult"); 
      http.addHeader("Content-Type", "application/json");
      int responseCode = http.POST(json);
      if(responseCode != 200) Serial.println("Server Error: Failed to show autowater event");
      http.end();
      Serial.println("");
      Serial.println("Finished Watering Plant");
    }
  }
}

void manualPump() {
  if(!server.hasArg("plain")) {
    server.send(400, "application/json", R"({"message":"No body"})");
    return;
  }
  String body = server.arg("plain");
  StaticJsonDocument<256>manualDoc;
  DeserializationError err = deserializeJson(manualDoc, body);
  if (err) {
    server.send(400, "application/json", R"({"message":"Invalid JSON"})");
    return;
  }
  if (!manualDoc.containsKey("pump_pin") ||
    !manualDoc.containsKey("soil_pin") ||
    !manualDoc.containsKey("max_moist") ||
    !manualDoc.containsKey("name")) {
    server.send(400, "application/json", R"({"message":"Missing fields"})");
    return;
  }

  for(int i = 0; i < plantSize; i++){
    if(manualDoc["pump_pin"] == plants[i].pump_pin) {
      plants[i].manual_watering = 1;
      plants[i].name = manualDoc["name"].as<String>();
    }
  }
  turnOnPump(manualDoc["pump_pin"], manualDoc["soil_pin"], manualDoc["max_moist"]);
  server.send(200, "application/json", R"({"message":"turned on pump"})");
}

void autoPump(int pump_pin, int soil_pin, int max_moist) {
  for(int i = 0; i < plantSize; i++){
    if(pump_pin == plants[i].pump_pin) plants[i].auto_watering = 1;
  }
  turnOnPump(pump_pin, soil_pin, max_moist);
}

int readStableAdc(int pin, int samples = 5) {
    int readings[samples];

    for (int i = 0; i < samples; i++) {
        readings[i] = analogRead(pin);
        delay(2);
    }

    for (int i = 0; i < samples - 1; i++) {
        for (int j = i + 1; j < samples; j++) {
            if (readings[j] < readings[i]) {
                int temp = readings[i];
                readings[i] = readings[j];
                readings[j] = temp;
            }
        }
    }

    int start = samples * 0.2;
    int end = samples * 0.8;
    long total = 0;
    int count = 0;

    for (int i = start; i < end; i++) {
        total += readings[i];
        count++;
    }
    return total / count;
}


void checkWaterState() {
  for(int i = 0; i < plantSize; i++) {
    int raw = readStableAdc(plants[i].soil_pin);
    float moisture = raw == 0 ? 0 : 100 - (floor( raw / 4095.0 * 1000.0) / 10.0); 
    if(plants[i].auto_mode == 1) {
      if(plants[i].manual_watering == 1) {
        turnOffPump(plants[i].pump_pin);
      }

      if(plants[i].min_moist >= moisture && digitalRead(plants[i].pump_pin) == HIGH){
        autoPump(plants[i].pump_pin, plants[i].soil_pin, plants[i].max_moist);
      } 
      else {
        if(millis() - plants[i].waterCurrentTime >= 2000) {
          plants[i].waterCurrentTime = millis();
          Serial.print(".");
        }
      }
    }
    if(plants[i].auto_watering == 1 && plants[i].auto_mode == 0) {
      turnOffPump(plants[i].pump_pin);
    }
    if(moisture >= plants[i].max_moist && digitalRead(plants[i].pump_pin) == LOW) {
      turnOffPump(plants[i].pump_pin);
    }
    if(digitalRead(plants[i].pump_pin) == LOW && millis() - plants[i].waterStartTime >= (mlHandicapTime / mlPerSec) * 1000) {
      turnOffPump(plants[i].pump_pin);
    }
  }
}

void updateHumidity() {
  for (int i = 0; i < plantSize; i++) {
    if (plants[i].is_watering == 1) return;
  }

  static int failCount = 0;
  float humidity = dht.readHumidity();
  if (isnan(humidity)) {
    Serial.println("DHT failed");
    failCount++;
    if (failCount >= 3) {
      Serial.println("Reinitializing DHT");
      resetDht();
      failCount = 0;
    }
    return;
  }

  failCount = 0;
  HTTPClient http;
  StaticJsonDocument<128> doc;
  doc["humidity"] = humidity;

  String json;
  serializeJson(doc, json);

  http.begin(urlBase + "/api/updateHumidity");
  http.addHeader("Content-Type", "application/json");
  http.POST(json);
  http.end();

}


void updateMoisture() {
  StaticJsonDocument<512>moistureDoc;
  JsonArray arr = moistureDoc.createNestedArray();
  for(int i = 0; i < plantSize; i++) {
    JsonObject obj = arr.createNestedObject();
    int rawMoist = readStableAdc(plants[i].soil_pin);
    float computedMoisture = rawMoist == 0 ? 0 : 100 - (floor( rawMoist / 4095.0 * 1000.0) / 10.0);
    obj["plant_id"] = plants[i].plant_id;
    obj["soil_pin"] = plants[i].soil_pin;
    obj["moisture"] = computedMoisture;
  }
  HTTPClient http;
  http.begin(urlBase + "/api/updateMoisture");
  http.addHeader("Content-Type", "application/json");
  String json;
  serializeJson(moistureDoc, json);
  int responseCode = http.POST(json);
  // if(responseCode != 200) Serial.println("Failed to update moisture");
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(500);

  WiFi.begin(ssid, password);
  Serial.print("Connecting");
  int attempt = 0;
  while (WiFi.status() != WL_CONNECTED) {
    if(attempt >= 40) break;
    Serial.print(".");
    delay(500);
    attempt++;
  }

  if(attempt >= 40) {
    Serial.println("");
    Serial.println("Failed to connect to the Network");
  } else {
    Serial.println("");
    Serial.print("Connected Successfully ");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    updatePlantConfig();
    for(int i = 0; i < plantSize; i++){
      digitalWrite(plants[i].pump_pin, HIGH); //relay ito so high ang off, Off default sa init
      plants[i].name = "";
      plants[i].auto_watering = 0;
      plants[i].manual_watering = 0;
      plants[i].waterStartTime = 0;
      plants[i].waterCurrentTime = 0;
    }

    //dito mga routes
    server.on("/api/esp/waterPump", HTTP_POST, manualPump);
    server.on("/api/esp/updatePlantConfig", HTTP_POST, updatePlantConfig);
    server.begin();
    Serial.println("Esp server is now running on port: 80");
    dht.begin();
  }
}

void loop() {
  if(WiFi.status() == WL_CONNECTED) {
    server.handleClient();
    if(millis() - humidityMillis >= 3000) {
      updateHumidity();
      humidityMillis = millis();
    }
    if(millis() - soilMillis >= 2000) {
      updateMoisture(); 
      soilMillis = millis();
    }
    if(millis() - checkMillis >= 500) {
      checkWaterState(); 
      checkMillis = millis();
    }

  } else {
    delay(2000);
    Serial.println("Network Connection Error...");
  }
}
