package com.bulletjournal.util;

import com.google.gson.*;
import com.google.gson.annotations.SerializedName;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class DeltaContent {

    public static final String DELTA = "delta";
    public static final String EMPTY_CONTENT = "{\"delta\":{\"ops\":[{\"insert\":\" \\n\"}]}}";
    private static final Gson GSON = new GsonBuilder().
            registerTypeAdapter(Double.class, new JsonSerializer<Double>() {
                @Override
                public JsonElement serialize(Double src, Type typeOfSrc, JsonSerializationContext context) {
                    if (src == src.longValue())
                        return new JsonPrimitive(src.longValue());
                    return new JsonPrimitive(src);
                }
            }).disableHtmlEscaping().create();
    private static final Logger LOGGER = LoggerFactory.getLogger(DeltaContent.class);

    @SerializedName(DELTA)
    private Map deltaMap;

    private List<Object> diff;

    public DeltaContent(String text) {
        LinkedHashMap<String, Object> map = GSON.fromJson(text, LinkedHashMap.class);
        deltaMap = adjustDelta((Map) map.get(DELTA));
        diff = (List) map.get("diff");
    }

    private Map adjustDelta(final Map<String, Object> deltaMap) {
        if (deltaMap == null) {
            return null;
        }
        List<Map<String, Object>> deltaList = new ArrayList<>();
        List<LinkedHashMap> opsList = (ArrayList) (deltaMap.get("ops"));
        for (Map<String, Object> innerDeltaMap : opsList) {
            if (innerDeltaMap.containsKey("insert") && (innerDeltaMap.get("insert")) instanceof Map) {
                Map insertMap = (Map) innerDeltaMap.get("insert");
                if (insertMap.containsKey("emoji")) {
                    deltaList.add(DeltaConverter.WebToMobile.webToMobileEmoji(insertMap));
                    continue;
                }
            }
            deltaList.add(innerDeltaMap);
        }

        LinkedHashMap opsMap = new LinkedHashMap();
        opsMap.put("ops", deltaList);
        return opsMap;
    }

    public boolean hasDeltaMap() {
        return this.deltaMap != null;
    }

    public Map getDeltaMap() {
        return deltaMap;
    }

    public void setDeltaMap(Map deltaMap) {
        this.deltaMap = deltaMap;
    }

    public List<Object> getDiff() {
        return diff;
    }

    public List<Object> getDiffOrDefault(List<Object> defaultValue) {
        return diff != null ? diff : defaultValue;
    }

    public void setDiff(List<Object> diff) {
        this.diff = diff;
    }

    public String toJSON() {
        return GSON.toJson(this);
    }
}
